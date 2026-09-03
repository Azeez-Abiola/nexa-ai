import axios from "axios";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { ConnectorIdentity } from "../../../models/ConnectorIdentity";
import { encryptSecret, decryptSecret, connectorEncryptionAvailable } from "../../../utils/encryption";
import logger from "../../../utils/logger";

/**
 * The Auth Service for Microsoft-backed connectors.
 *
 * Owns per-user consent, refresh-token custody, and the exchange of that token for
 * the short-lived access tokens Graph actually wants. Nothing above this file ever
 * sees a credential; callers ask for "an access token for this user with these
 * scopes" and get one, or a reason they cannot have one.
 *
 * Why per-user consent rather than one service account: a service account holds the
 * union of everyone's access, so Nexa would be able to read documents the person
 * asking cannot. Permission inheritance is the property the whole connector design
 * rests on, and a shared credential silently destroys it — the assistant keeps
 * answering, just with data the asker was never entitled to.
 */

const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID;
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const CONNECTOR_CALLBACK_URL = process.env.AZURE_CONNECTOR_CALLBACK_URL;

const AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me";

/**
 * Scopes requested when a user connects Microsoft.
 *
 * Read-only, and no wider than the pilot needs. `offline_access` is what yields a
 * refresh token at all. These are requested at connect time rather than at login
 * because most employees will never enable a connector, and asking the whole company
 * to consent to file access during SSO — to get a feature they have not asked for —
 * is how an integration gets blocked by IT on principle.
 */
export const MICROSOFT_CONNECTOR_SCOPES = [
  "offline_access",
  "Files.Read.All",
  "Sites.Read.All"
];

/** Whether this deployment can offer Microsoft connectors at all. */
export function microsoftConnectorConfigured(): boolean {
  return Boolean(
    AZURE_CLIENT_ID && AZURE_CLIENT_SECRET && CONNECTOR_CALLBACK_URL && connectorEncryptionAvailable()
  );
}

/** Reason the connector is unavailable, for an admin-facing message. */
export function microsoftConfigurationGap(): string | null {
  const missing = [
    !AZURE_CLIENT_ID && "AZURE_CLIENT_ID",
    !AZURE_CLIENT_SECRET && "AZURE_CLIENT_SECRET",
    !CONNECTOR_CALLBACK_URL && "AZURE_CONNECTOR_CALLBACK_URL",
    !connectorEncryptionAvailable() && "CONNECTOR_TOKEN_ENCRYPTION_KEY"
  ].filter(Boolean);
  return missing.length ? `Missing configuration: ${missing.join(", ")}` : null;
}

// ─── OAuth state ──────────────────────────────────────────────────────────────

/**
 * Signed, expiring state parameter.
 *
 * The callback arrives as a plain browser redirect with no Authorization header, so
 * the user's identity has to travel in `state` — and `state` is attacker-controllable
 * unless it is authenticated. Signing it with the client secret means a forged
 * callback cannot bind someone else's Microsoft account to this user's Nexa
 * identity, which is the actual attack here (an attacker consents with their own
 * account and grafts the grant onto a victim's row, or vice versa).
 */
const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  // Tied to the client secret so state cannot be forged without also holding the
  // credential that would let an attacker complete the flow anyway.
  return AZURE_CLIENT_SECRET || "unconfigured";
}

export function encodeState(userId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${Date.now()}.${nonce}`;
  const mac = createHmac("sha256", stateSecret()).update(payload).digest("hex").slice(0, 32);
  return Buffer.from(`${payload}.${mac}`).toString("base64url");
}

export function decodeState(state: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4) return null;
    const [userId, issuedAt, nonce, mac] = parts;

    const expected = createHmac("sha256", stateSecret())
      .update(`${userId}.${issuedAt}.${nonce}`)
      .digest("hex")
      .slice(0, 32);

    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    if (Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;
    return { userId };
  } catch {
    return null;
  }
}

/** The Microsoft consent URL to send the user to. */
export function buildConsentUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: AZURE_CLIENT_ID!,
    response_type: "code",
    redirect_uri: CONNECTOR_CALLBACK_URL!,
    response_mode: "query",
    scope: MICROSOFT_CONNECTOR_SCOPES.join(" "),
    state: encodeState(userId),
    // Forces the account chooser. Without it a user with several Microsoft accounts
    // silently connects whichever one the browser session already holds, and then
    // cannot work out why their files are missing.
    prompt: "select_account"
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// ─── Token exchange ───────────────────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

async function requestToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await axios.post<TokenResponse>(
    TOKEN_URL,
    new URLSearchParams({
      client_id: AZURE_CLIENT_ID!,
      client_secret: AZURE_CLIENT_SECRET!,
      ...body
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15_000 }
  );
  return response.data;
}

/**
 * Complete the consent flow and store the grant.
 *
 * Returns the connected account so the caller can show which one it was — a user who
 * consented with a personal account instead of their work one needs to be able to
 * see that immediately rather than discovering it through empty search results.
 */
export async function completeConsent(
  userId: string,
  code: string
): Promise<{ accountEmail?: string; accountName?: string; scopes: string[] }> {
  const tokens = await requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: CONNECTOR_CALLBACK_URL!
  });

  if (!tokens.refresh_token) {
    // Without offline_access consent there is nothing durable to store, and the
    // connector would work until the access token expired and then stop for reasons
    // the user could not act on.
    throw new Error("Microsoft did not return a refresh token — offline_access was not granted");
  }

  let accountEmail: string | undefined;
  let accountName: string | undefined;
  try {
    const me = await axios.get<{ mail?: string; userPrincipalName?: string; displayName?: string }>(
      GRAPH_ME_URL,
      { headers: { Authorization: `Bearer ${tokens.access_token}` }, timeout: 10_000 }
    );
    accountEmail = me.data.mail || me.data.userPrincipalName;
    accountName = me.data.displayName;
  } catch {
    // Cosmetic only — the grant itself is valid without it.
  }

  const scopes = (tokens.scope || MICROSOFT_CONNECTOR_SCOPES.join(" ")).split(" ").filter(Boolean);

  await ConnectorIdentity.findOneAndUpdate(
    { userId, provider: "microsoft" },
    {
      userId,
      provider: "microsoft",
      refreshTokenEncrypted: encryptSecret(tokens.refresh_token),
      scopes,
      accountEmail: accountEmail || null,
      accountName: accountName || null,
      lastRefreshAt: new Date(),
      // Re-consenting is the documented fix for an invalidated grant, so clear the
      // flags rather than leaving the row looking broken after a successful reconnect.
      invalidatedAt: null,
      invalidationReason: null
    },
    { upsert: true, new: true }
  );

  cacheDelete(userId);

  logger.info("[MicrosoftAuth] Connector identity stored", {
    userId,
    scopes: scopes.length,
    hasAccountEmail: Boolean(accountEmail)
  });

  return { accountEmail, accountName, scopes };
}

// ─── Access token cache ───────────────────────────────────────────────────────

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

/**
 * In-memory, per-user access tokens.
 *
 * A chat turn can make several tool calls, and redeeming the refresh token for each
 * one would put a round trip to Microsoft in front of every call and burn through
 * Entra's token endpoint limits. Held in memory rather than in Mongo on purpose:
 * these are bearer credentials, and a process restart losing them costs one refresh.
 */
const tokenCache = new Map<string, CachedToken>();

/** Refresh this long before actual expiry, so a token cannot die mid-call. */
const EXPIRY_MARGIN_MS = 120_000;

function cacheKey(userId: string): string {
  return `microsoft:${userId}`;
}

function cacheDelete(userId: string): void {
  tokenCache.delete(cacheKey(userId));
}

/** Errors a caller can act on, separated from transient ones. */
export class ConnectorAuthError extends Error {
  constructor(
    message: string,
    /** True when the user must re-consent; false when it is worth retrying. */
    readonly needsReconnect: boolean
  ) {
    super(message);
    this.name = "ConnectorAuthError";
  }
}

/**
 * An access token for this user, refreshing if needed.
 *
 * Throws ConnectorAuthError rather than returning null so the distinction between
 * "reconnect your account" and "Microsoft is having a moment" survives up to the
 * tool result the model reads — those need different things said to the user.
 */
export async function accessTokenForUser(userId: string): Promise<string> {
  if (!microsoftConnectorConfigured()) {
    throw new ConnectorAuthError(
      `Microsoft connectors are not configured on this server. ${microsoftConfigurationGap()}`,
      false
    );
  }

  const cached = tokenCache.get(cacheKey(userId));
  if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return cached.accessToken;
  }

  const identity = await ConnectorIdentity.findOne({ userId, provider: "microsoft" });
  if (!identity) {
    throw new ConnectorAuthError("This user has not connected their Microsoft account.", true);
  }
  if (identity.invalidatedAt) {
    throw new ConnectorAuthError(
      `The Microsoft connection needs to be re-authorized: ${identity.invalidationReason || "access was revoked"}.`,
      true
    );
  }

  let refreshToken: string;
  try {
    refreshToken = decryptSecret(identity.refreshTokenEncrypted);
  } catch (err) {
    // A credential that will not decrypt is unusable and will not fix itself — most
    // likely the connector key was rotated without re-consent. Mark it so the user
    // is prompted once rather than hitting the same failure on every turn.
    await markInvalid(userId, "stored credential could not be decrypted");
    throw new ConnectorAuthError(
      "The stored Microsoft credential could not be read. Please reconnect the account.",
      true
    );
  }

  try {
    const tokens = await requestToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: MICROSOFT_CONNECTOR_SCOPES.join(" ")
    });

    // Entra rotates refresh tokens. Missing the replacement means the grant works
    // until the old token is retired and then fails for no visible reason.
    if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
      identity.refreshTokenEncrypted = encryptSecret(tokens.refresh_token);
    }
    identity.lastRefreshAt = new Date();
    await identity.save();

    tokenCache.set(cacheKey(userId), {
      accessToken: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000
    });

    return tokens.access_token;
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    const errorCode = axios.isAxiosError(err)
      ? (err.response?.data as { error?: string } | undefined)?.error
      : undefined;

    // `invalid_grant` is Entra saying the grant is gone — revoked by the user, by an
    // admin, or expired. Retrying cannot help, so record it and stop asking.
    if (status === 400 && errorCode === "invalid_grant") {
      await markInvalid(userId, "the grant was revoked or expired");
      throw new ConnectorAuthError(
        "The Microsoft connection is no longer valid. Please reconnect the account.",
        true
      );
    }

    logger.error("[MicrosoftAuth] Token refresh failed", { userId, status, errorCode });
    throw new ConnectorAuthError(
      "Could not reach Microsoft to refresh access. Please try again shortly.",
      false
    );
  }
}

async function markInvalid(userId: string, reason: string): Promise<void> {
  cacheDelete(userId);
  await ConnectorIdentity.updateOne(
    { userId, provider: "microsoft" },
    { invalidatedAt: new Date(), invalidationReason: reason }
  );
  logger.warn("[MicrosoftAuth] Identity marked invalid", { userId, reason });
}

/** Whether this user currently has a usable Microsoft grant. */
export async function hasMicrosoftIdentity(userId: string): Promise<boolean> {
  if (!microsoftConnectorConfigured()) return false;
  const identity = await ConnectorIdentity.findOne({
    userId,
    provider: "microsoft",
    invalidatedAt: null
  })
    .select("_id")
    .lean();
  return Boolean(identity);
}

/**
 * Forget a user's grant.
 *
 * Deletes Nexa's copy and drops the cached access token. It does not revoke at
 * Microsoft — that is the user's own action in their account, and Nexa claiming to
 * have done it would be a lie the audit trail would carry. Told to the user plainly
 * by the route that calls this.
 */
export async function disconnectMicrosoft(userId: string): Promise<boolean> {
  cacheDelete(userId);
  const result = await ConnectorIdentity.deleteOne({ userId, provider: "microsoft" });
  return result.deletedCount > 0;
}
