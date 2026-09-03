import express, { Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { ConnectorIdentity } from "../models/ConnectorIdentity";
import { connectorAvailability } from "../services/tools/registry";
import {
  buildConsentUrl,
  completeConsent,
  decodeState,
  disconnectMicrosoft,
  microsoftConnectorConfigured,
  microsoftConfigurationGap
} from "../services/tools/auth/microsoftAuth";
import { logEvent } from "../services/auditService";
import logger from "../utils/logger";

/**
 * The employee's own connector settings: what is available, and connecting it.
 *
 * Distinct from /admin/connectors, which is where an administrator decides what a
 * business unit may use at all. This router is where an individual grants Nexa access
 * to their own account — and it can only ever narrow what the admin allowed, never
 * widen it.
 */
export const connectorAuthRouter = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/** Where the browser lands after consent, with an outcome it can render. */
function settingsRedirect(res: Response, params: Record<string, string>) {
  const query = new URLSearchParams(params).toString();
  return res.redirect(`${FRONTEND_URL}/settings/connectors?${query}`);
}

/**
 * What this user can use, and what they could connect.
 *
 * Returns both halves because they are different states with different next actions:
 * a connector waiting on this person shows a Connect button, one waiting on their
 * administrator shows nothing they can do about it.
 */
connectorAuthRouter.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const businessUnit = String(req.businessUnit || "").trim();
    if (!businessUnit) return res.status(400).json({ error: "Business unit not found in token" });

    const { usable, needsUserConnection } = await connectorAvailability({
      userId: req.userId,
      adminId: req.adminId,
      email: req.email,
      businessUnit,
      department: req.department,
      isAdmin: Boolean(req.isAdmin),
      // Availability does not depend on which model is answering; this endpoint is
      // not serving a turn, so the field is filled in only to satisfy the type.
      provider: "gpt"
    });

    const identities = req.userId
      ? await ConnectorIdentity.find({ userId: req.userId }).select("provider accountEmail accountName invalidatedAt invalidationReason").lean()
      : [];

    const describe = (connected: boolean) => (c: (typeof usable)[number]) => {
      const identity = identities.find((i) => i.provider === c.requiresIdentity);
      return {
        connectorId: c.connectorId,
        label: c.label,
        description: c.description,
        requiresIdentity: c.requiresIdentity,
        dataLeavesNetwork: c.dataEgress === "third_party",
        connected,
        account: identity
          ? { email: identity.accountEmail, name: identity.accountName }
          : null,
        // Surfaced so a revoked grant reads as "reconnect" rather than silently
        // behaving like it was never connected.
        needsReconnect: Boolean(identity?.invalidatedAt),
        reconnectReason: identity?.invalidationReason ?? null
      };
    };

    res.json({
      connectors: [
        ...usable.map(describe(true)),
        ...needsUserConnection.map(describe(false))
      ],
      microsoft: {
        available: microsoftConnectorConfigured(),
        // Only an admin is shown why: a missing server-side env var is not something
        // an employee can act on, and naming it to them is noise at best.
        configurationGap: req.isAdmin ? microsoftConfigurationGap() : null
      }
    });
  } catch (err) {
    logger.error("[ConnectorAuth] Listing failed", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to load connectors" });
  }
});

/** Begin Microsoft consent. Returns the URL rather than redirecting, so the SPA can open it. */
connectorAuthRouter.get(
  "/microsoft/connect",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!microsoftConnectorConfigured()) {
      return res.status(503).json({
        error: "Microsoft connectors are not configured on this server.",
        ...(req.isAdmin ? { detail: microsoftConfigurationGap() } : {})
      });
    }
    if (!req.userId) {
      return res.status(400).json({ error: "A user account is required to connect Microsoft 365." });
    }

    res.json({ url: buildConsentUrl(req.userId) });
  }
);

/**
 * Microsoft's redirect back after consent.
 *
 * Unauthenticated by necessity — a browser redirect carries no Authorization header —
 * which is why the user's identity travels in a signed `state` rather than a plain
 * one. An unsigned state here would let an attacker bind their own Microsoft account
 * to somebody else's Nexa user.
 */
connectorAuthRouter.get("/microsoft/callback", async (req, res: Response) => {
  const { code, state, error, error_description: errorDescription } = req.query as Record<string, string>;

  if (error) {
    logger.warn("[ConnectorAuth] Microsoft consent declined", { error, errorDescription });
    return settingsRedirect(res, { connector: "microsoft", status: "declined" });
  }

  if (!code || !state) {
    return settingsRedirect(res, { connector: "microsoft", status: "invalid" });
  }

  const decoded = decodeState(state);
  if (!decoded) {
    // Covers a forged state, a tampered one, and one that simply took too long.
    logger.warn("[ConnectorAuth] Rejected Microsoft callback with bad state");
    return settingsRedirect(res, { connector: "microsoft", status: "expired" });
  }

  try {
    const { accountEmail } = await completeConsent(decoded.userId, code);

    logEvent("connector_identity_connected", {
      userId: decoded.userId,
      businessUnit: "",
      action: "Connector Account Connected",
      details: `Microsoft 365 connected${accountEmail ? ` as ${accountEmail}` : ""}`,
      metadata: { provider: "microsoft", accountEmail }
    });

    return settingsRedirect(res, {
      connector: "microsoft",
      status: "connected",
      ...(accountEmail ? { account: accountEmail } : {})
    });
  } catch (err) {
    logger.error("[ConnectorAuth] Microsoft consent exchange failed", {
      error: err instanceof Error ? err.message : String(err)
    });
    return settingsRedirect(res, { connector: "microsoft", status: "failed" });
  }
});

/** Forget this user's Microsoft grant. */
connectorAuthRouter.delete(
  "/microsoft",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.userId) return res.status(400).json({ error: "A user account is required." });

      const removed = await disconnectMicrosoft(req.userId);

      if (removed) {
        logEvent("connector_identity_disconnected", {
          userId: req.userId,
          businessUnit: String(req.businessUnit || ""),
          action: "Connector Account Disconnected",
          details: "Microsoft 365 disconnected",
          metadata: { provider: "microsoft" }
        });
      }

      res.json({
        disconnected: removed,
        /**
         * Said explicitly because it would otherwise be assumed. Deleting Nexa's copy
         * stops Nexa using the account, but the consent grant still exists in the
         * user's Microsoft account until they remove it there. Implying otherwise
         * would leave someone believing they had revoked access when they had not.
         */
        note:
          "Nexa no longer holds access to your Microsoft account. To remove the consent " +
          "grant itself, visit myaccount.microsoft.com and remove Nexa from your connected apps."
      });
    } catch (err) {
      logger.error("[ConnectorAuth] Disconnect failed", { error: (err as Error).message });
      res.status(500).json({ error: "Failed to disconnect Microsoft 365" });
    }
  }
);
