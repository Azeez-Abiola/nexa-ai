import express, { Response } from "express";
import { Connector, ConnectorEnablement } from "../models/Connector";
import { adminAuthMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { enablementFor } from "../services/tools/registry";
import { invalidateCatalogCache, listConnectorTools } from "../services/tools/mcp/clientPool";
import { logEvent } from "../services/auditService";
import { resolveUserDirectoryBusinessUnit } from "../utils/tenantResolution";
import logger from "../utils/logger";

/**
 * Admin controls for the Connector Registry.
 *
 * Deliberately scoped to *policy*, not to creating connectors. A connector's
 * existence is a deployment concern — a first-party server ships with the code, a
 * remote one needs an endpoint and credentials — whereas whether it is live for a
 * given business unit, and whether it may write, is a decision an administrator
 * makes and should be able to change without a release.
 *
 * A business-unit admin governs their own unit and no other. Super admins act on a
 * unit by naming it, which is why every handler resolves the target unit through the
 * same tenant helper the rest of the admin surface uses rather than reading it from
 * the body directly.
 */
export const adminConnectorsRouter = express.Router();
adminConnectorsRouter.use(adminAuthMiddleware);

async function resolveScopedBusinessUnit(
  req: AuthenticatedRequest,
  explicit?: string
): Promise<string | null> {
  const fromQuery = (req.query.businessUnit as string) || "";
  const scoped = (explicit ?? fromQuery).trim();
  return resolveUserDirectoryBusinessUnit(req, scoped || undefined);
}

/**
 * List connectors with this business unit's settings, and what each one exposes.
 *
 * The live tool list is included because "force read-only" is meaningless to an
 * admin who cannot see which tools a connector actually has. Tools come from the
 * catalog cache, so this is cheap after the first call.
 */
adminConnectorsRouter.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bu = await resolveScopedBusinessUnit(req);
    if (!bu) {
      return res.status(400).json({
        error:
          "businessUnit is required (super admin: pass ?businessUnit= tenant name, label, or slug — not SUPERADMIN)."
      });
    }

    const connectors = await Connector.find().sort({ label: 1 });

    const payload = await Promise.all(
      connectors.map(async (connector) => {
        const rule = enablementFor(connector, bu);
        const tools = await listConnectorTools(connector);
        return {
          connectorId: connector.connectorId,
          label: connector.label,
          description: connector.description,
          kind: connector.kind,
          transport: connector.transport,
          /**
           * Surfaced explicitly for the data-residency question a holding company
           * has to be able to answer: which of these send our data off our network.
           */
          dataLeavesNetwork: connector.kind === "remote",
          globallyEnabled: connector.enabled,
          settings: rule
            ? {
                enabled: rule.enabled,
                writeEnabled: rule.writeEnabled,
                approved: rule.approved,
                allowedDepartments: rule.allowedDepartments,
                adminOnly: rule.adminOnly
              }
            : null,
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            access: t.access
          })),
          // Empty when the server is unreachable — worth showing rather than
          // presenting a connector as healthy because it has a row in the database.
          reachable: tools.length > 0
        };
      })
    );

    res.json({ businessUnit: bu, connectors: payload });
  } catch (err) {
    logger.error("[Connectors] List error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to list connectors" });
  }
});

/** Fields an admin may change for their business unit. */
interface EnablementPatch {
  enabled?: boolean;
  writeEnabled?: boolean;
  approved?: boolean;
  allowedDepartments?: string[];
  adminOnly?: boolean;
}

adminConnectorsRouter.patch(
  "/:connectorId",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const bu = await resolveScopedBusinessUnit(req, req.body.businessUnit);
      if (!bu) {
        return res.status(400).json({ error: "businessUnit is required" });
      }

      const connector = await Connector.findOne({
        connectorId: String(req.params.connectorId).toLowerCase()
      });
      if (!connector) return res.status(404).json({ error: "Connector not found" });

      const patch = req.body as EnablementPatch;

      let rule = enablementFor(connector, bu);
      if (!rule) {
        // A unit created after the connector was seeded has no row yet. Created
        // closed — disabled and read-only — so an admin turning one field on cannot
        // accidentally grant everything.
        rule = {
          businessUnit: bu,
          enabled: false,
          writeEnabled: false,
          approved: false,
          allowedDepartments: [],
          adminOnly: false
        } as ConnectorEnablement;
        connector.enablement.push(rule);
      }

      const before = {
        enabled: rule.enabled,
        writeEnabled: rule.writeEnabled,
        approved: rule.approved,
        adminOnly: rule.adminOnly,
        allowedDepartments: [...rule.allowedDepartments]
      };

      if (typeof patch.enabled === "boolean") rule.enabled = patch.enabled;
      if (typeof patch.approved === "boolean") rule.approved = patch.approved;
      if (typeof patch.adminOnly === "boolean") rule.adminOnly = patch.adminOnly;
      if (Array.isArray(patch.allowedDepartments)) {
        rule.allowedDepartments = patch.allowedDepartments
          .map((d) => String(d).trim())
          .filter(Boolean);
      }

      if (typeof patch.writeEnabled === "boolean") {
        // Enabling writes means the model can change things in the source system, so
        // it is the one field that must not be settable on a connector that has not
        // been approved for the unit.
        if (patch.writeEnabled && !rule.approved) {
          return res.status(400).json({
            error: "Approve the connector for this business unit before enabling write access."
          });
        }
        rule.writeEnabled = patch.writeEnabled;
      }

      await connector.save();

      /**
       * The catalog cache is per connector, not per business unit, so it is dropped
       * wholesale. Without this a connector an admin just switched off would keep
       * answering for up to the cache TTL — the gap between the audit trail and
       * reality that makes a control untrustworthy.
       */
      invalidateCatalogCache();

      logEvent("connector_settings_changed", {
        adminId: req.adminId,
        adminEmail: req.email,
        businessUnit: bu,
        action: "Connector Settings Changed",
        details: `${connector.label} updated for ${bu}`,
        metadata: {
          connector: connector.connectorId,
          before,
          after: {
            enabled: rule.enabled,
            writeEnabled: rule.writeEnabled,
            approved: rule.approved,
            adminOnly: rule.adminOnly,
            allowedDepartments: rule.allowedDepartments
          }
        }
      });

      res.json({
        connectorId: connector.connectorId,
        businessUnit: bu,
        settings: {
          enabled: rule.enabled,
          writeEnabled: rule.writeEnabled,
          approved: rule.approved,
          allowedDepartments: rule.allowedDepartments,
          adminOnly: rule.adminOnly
        }
      });
    } catch (err) {
      logger.error("[Connectors] Update error", { error: (err as Error).message });
      res.status(500).json({ error: "Failed to update connector" });
    }
  }
);
