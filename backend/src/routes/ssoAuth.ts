import express, { Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User";
import { AdminUser } from "../models/AdminUser";
import { tenantProfileForBu } from "./auth";
import { findBusinessUnitForAdminLogin } from "./adminAuth";
import { logEvent } from "../services/auditService";

export const ssoAuthRouter = express.Router();

const JWT_SECRET = process.env.NEXA_AI_JWT_SECRET!;
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID!;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;
const AZURE_SSO_CALLBACK_URL = process.env.AZURE_SSO_CALLBACK_URL!;

const MICROSOFT_AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MICROSOFT_GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me";
const MICROSOFT_SCOPE = "openid profile email User.Read";

function ssoErrorRedirect(res: Response, reason: string) {
  return res.redirect(`${FRONTEND_URL}/auth/sso/error?reason=${reason}`);
}

// GET /api/v1/auth/sso/microsoft — kicks off the Microsoft OAuth round-trip. State is a
// short-lived signed JWT (not a session-stored value) since this app is 100% stateless/bearer-JWT;
// base64url-encoding it keeps the state param free of characters Microsoft/browsers might mangle.
ssoAuthRouter.get("/microsoft", (_req: Request, res: Response) => {
  const nonce = crypto.randomUUID();
  const stateJwt = jwt.sign({ nonce }, JWT_SECRET, { expiresIn: "10m" });
  const state = Buffer.from(stateJwt).toString("base64url");

  const params = new URLSearchParams({
    client_id: AZURE_CLIENT_ID,
    response_type: "code",
    redirect_uri: AZURE_SSO_CALLBACK_URL,
    response_mode: "query",
    scope: MICROSOFT_SCOPE,
    state
  });

  res.redirect(`${MICROSOFT_AUTHORIZE_URL}?${params.toString()}`);
});

// GET /api/v1/auth/sso/microsoft/callback — exchanges the code, resolves the account, and
// redirects (never JSON) to a role-aware frontend URL carrying the app's tokens as query params.
ssoAuthRouter.get("/microsoft/callback", async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== "string" || !state || typeof state !== "string") {
      return ssoErrorRedirect(res, "invalid_state");
    }

    try {
      const stateJwt = Buffer.from(state, "base64url").toString("utf8");
      jwt.verify(stateJwt, JWT_SECRET);
    } catch {
      return ssoErrorRedirect(res, "invalid_state");
    }

    let accessToken: string;
    try {
      const tokenResp = await axios.post(
        MICROSOFT_TOKEN_URL,
        new URLSearchParams({
          client_id: AZURE_CLIENT_ID,
          client_secret: AZURE_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: AZURE_SSO_CALLBACK_URL,
          scope: MICROSOFT_SCOPE
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );
      accessToken = tokenResp.data.access_token;
    } catch (error) {
      console.error("Microsoft token exchange failed:", error);
      return ssoErrorRedirect(res, "invalid_state");
    }

    let profile: any;
    try {
      const graphResp = await axios.get(MICROSOFT_GRAPH_ME_URL, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      profile = graphResp.data;
    } catch (error) {
      console.error("Microsoft Graph profile fetch failed:", error);
      return ssoErrorRedirect(res, "invalid_state");
    }

    const providerId: string | undefined = profile?.id;
    const email = String(profile?.mail || profile?.userPrincipalName || "").toLowerCase().trim();
    const firstName: string = profile?.givenName || "";
    const lastName: string = profile?.surname || "";

    if (!providerId || !email) {
      return ssoErrorRedirect(res, "no_account");
    }

    let account: any = await User.findOne({ microsoftId: providerId });
    let isAdminAccount = false;

    if (!account) {
      account = await AdminUser.findOne({ microsoftId: providerId });
      if (account) isAdminAccount = true;
    }

    if (!account) {
      account = await User.findOne({ email });
      if (!account) {
        account = await AdminUser.findOne({ email });
        if (account) isAdminAccount = true;
      }
    }

    if (!account) {
      return ssoErrorRedirect(res, "no_account");
    }

    if (account.isActive === false) {
      return ssoErrorRedirect(res, "account_inactive");
    }

    if (!account.microsoftId) account.microsoftId = providerId;
    if (!account.emailVerified) account.emailVerified = true;
    account.lastLogin = new Date();
    await account.save();

    let payload: any;
    if (isAdminAccount) {
      let tenantId: string | undefined;
      let tenantSlug: string | undefined;
      let tenantName: string | undefined;
      if (account.businessUnit !== "SUPERADMIN") {
        const buDoc = await findBusinessUnitForAdminLogin(account.businessUnit);
        if (buDoc) {
          tenantId = buDoc.tenantId;
          tenantSlug = buDoc.slug;
          tenantName = buDoc.name;
        }
      }
      payload = {
        adminId: account._id.toString(),
        email: account.email,
        fullName: account.fullName,
        businessUnit: account.businessUnit,
        tenantId,
        tenantSlug,
        tenantName,
        isAdmin: true,
        tokenVersion: account.tokenVersion || 0
      };
    } else {
      const tenant = await tenantProfileForBu(account.businessUnit);
      payload = {
        userId: account._id,
        email: account.email,
        businessUnit: account.businessUnit,
        department: account.department,
        tenantId: tenant.tenantId,
        tenantSlug: tenant.tenantSlug,
        tenantLogo: tenant.tenantLogo,
        tenantColor: tenant.tenantColor,
        isAdmin: account.businessUnit === "SUPERADMIN",
        tokenVersion: account.tokenVersion || 0
      };
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    logEvent(isAdminAccount ? "admin_login" : "user_login", {
      adminId: isAdminAccount ? account._id.toString() : undefined,
      userId: !isAdminAccount ? account._id.toString() : undefined,
      adminEmail: account.email,
      businessUnit: account.businessUnit,
      action: isAdminAccount ? "Admin Login" : "User Login",
      details: `${isAdminAccount ? "Admin" : "User"} signed in via Microsoft SSO`,
      metadata: {
        provider: "microsoft",
        firstName,
        lastName,
        ip: (req.headers["x-forwarded-for"] as string) || req.socket?.remoteAddress
      }
    });

    const role = isAdminAccount ? "admin" : "employee";
    // This app has a single 7-day JWT session model with no refresh-token table/rotation —
    // both params carry the same token so the redirect contract stays stable if a real
    // refresh flow is added later.
    res.redirect(
      `${FRONTEND_URL}/auth/${role}/sso/callback?accessToken=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(token)}`
    );
  } catch (error) {
    console.error("Microsoft SSO callback error:", error);
    return ssoErrorRedirect(res, "invalid_state");
  }
});
