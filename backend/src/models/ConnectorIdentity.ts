import mongoose, { Schema, Document } from "mongoose";

/**
 * One employee's OAuth grant to an external identity provider.
 *
 * This is the whole of Nexa's credential custody, and it is deliberately narrow.
 * There is one row per user per *identity provider*, not per service: consenting
 * once to Microsoft covers OneDrive, SharePoint and anything else reached through
 * Graph. The alternative — a stored credential per user per connector — would grow
 * Nexa into a credential vault holding live third-party access for the whole
 * holding company, which is a breach target out of all proportion to the feature.
 *
 * Only the refresh token is stored, encrypted. Access tokens are short-lived and
 * live in memory (see auth/microsoftAuth.ts), so a database dump yields nothing that
 * works without also holding the connector encryption key and the Azure client
 * secret. Revocation is a single row delete here, and the same action in Entra
 * revokes it centrally whether or not Nexa cooperates.
 */

export type IdentityProvider = "microsoft";

export interface ConnectorIdentityDocument extends Document {
  userId: string;
  provider: IdentityProvider;
  /** AES-256-GCM, keyed by CONNECTOR_TOKEN_ENCRYPTION_KEY. Never logged. */
  refreshTokenEncrypted: string;
  /**
   * Scopes the user actually consented to.
   *
   * Recorded because consent is incremental: a user who connected for file search
   * has not necessarily approved anything else, and the gateway must be able to tell
   * without asking Microsoft. A tool needing a scope absent from this list triggers a
   * re-consent rather than a confusing 403 from Graph.
   */
  scopes: string[];
  /** The external account that was connected — shown so a user can spot a wrong one. */
  accountEmail?: string;
  accountName?: string;
  /** Bumped on every successful refresh; a stale value points at a revoked grant. */
  lastRefreshAt?: Date;
  /** Set when a refresh has failed terminally, so the UI can prompt a reconnect. */
  invalidatedAt?: Date;
  invalidationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectorIdentitySchema = new Schema<ConnectorIdentityDocument>(
  {
    userId: { type: String, required: true, index: true },
    provider: { type: String, enum: ["microsoft"], required: true },
    refreshTokenEncrypted: { type: String, required: true },
    scopes: { type: [String], default: [] },
    accountEmail: { type: String, default: null },
    accountName: { type: String, default: null },
    lastRefreshAt: { type: Date, default: null },
    invalidatedAt: { type: Date, default: null },
    invalidationReason: { type: String, default: null }
  },
  { timestamps: true }
);

// One grant per user per provider — a second consent updates the existing row rather
// than accumulating credentials nothing will ever clean up.
ConnectorIdentitySchema.index({ userId: 1, provider: 1 }, { unique: true });

export const ConnectorIdentity = mongoose.model<ConnectorIdentityDocument>(
  "ConnectorIdentity",
  ConnectorIdentitySchema
);
