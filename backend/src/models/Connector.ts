import mongoose, { Schema, Document } from "mongoose";

/**
 * Where a connector's MCP server runs — and therefore where the data goes.
 *
 * Recorded per connector rather than inferred, because a holding company needs to
 * be able to answer "which of these send our data off our network" without reading
 * code. `first_party` servers are Nexa's own and never leave the deployment;
 * `remote` reaches a third party over the public internet.
 */
export type ConnectorKind = "first_party" | "remote";

/**
 * Where a connector's data actually goes.
 *
 * Deliberately stored rather than derived from `kind`. The Microsoft 365 connector is
 * a first-party server — Nexa runs it, so its calls pass the RBAC check and land in
 * the audit log — but it plainly does send data to Microsoft. Inferring residency
 * from where the server runs would have reported that connector as keeping data on
 * the network, which is the one thing a holding company must not be told wrongly.
 */
export type ConnectorDataEgress = "none" | "third_party";

/**
 * The identity provider a user must have connected before this connector works.
 *
 * Null for connectors that ride Nexa's own RBAC (the knowledge base). Set when the
 * connector calls a third party with the employee's own delegated credentials, which
 * is what keeps permission inheritance intact instead of Nexa holding a service
 * account with everyone's access at once.
 */
export type ConnectorIdentityRequirement = "microsoft" | null;

/** MCP transport. In-process for first-party servers, HTTP for remote ones. */
export type ConnectorTransport = "in_memory" | "streamable_http";

/**
 * Per-business-unit settings for one connector.
 *
 * A holding company's units do not want the same integrations — CHI may need a
 * manufacturing ERP that UAC Foods has no use for — so enablement is a property of
 * the pair, not of the connector alone.
 */
export interface ConnectorEnablement {
  businessUnit: string;
  enabled: boolean;
  /**
   * Admin "force read-only" switch. When false, the connector's write tools are
   * withheld from the catalog entirely for this unit — the model is never told they
   * exist, rather than being told and refused.
   */
  writeEnabled: boolean;
  /** A connector does not go live for a unit until an admin approves it. */
  approved: boolean;
  /** Empty means every department in the unit. */
  allowedDepartments: string[];
  /** When true, only admins in this unit see the connector's tools. */
  adminOnly: boolean;
}

export interface ConnectorDocument extends Document {
  /** Stable slug, also the first half of every qualified tool name. */
  connectorId: string;
  label: string;
  description: string;
  kind: ConnectorKind;
  dataEgress: ConnectorDataEgress;
  requiresIdentity: ConnectorIdentityRequirement;
  transport: ConnectorTransport;
  /** Required for `streamable_http`; unused for in-process servers. */
  endpoint?: string;
  /** Global allow-list gate: false hides the connector from every business unit. */
  enabled: boolean;
  enablement: ConnectorEnablement[];
  createdAt: Date;
  updatedAt: Date;
}

const EnablementSchema = new Schema<ConnectorEnablement>(
  {
    businessUnit: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    // Defaults to read-only. A write action against a third-party system is not
    // something to switch on by omission.
    writeEnabled: { type: Boolean, default: false },
    approved: { type: Boolean, default: false },
    allowedDepartments: { type: [String], default: [] },
    adminOnly: { type: Boolean, default: false }
  },
  { _id: false }
);

const ConnectorSchema = new Schema<ConnectorDocument>(
  {
    connectorId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    kind: { type: String, enum: ["first_party", "remote"], required: true },
    dataEgress: { type: String, enum: ["none", "third_party"], required: true },
    requiresIdentity: { type: String, enum: ["microsoft", null], default: null },
    transport: { type: String, enum: ["in_memory", "streamable_http"], required: true },
    endpoint: { type: String, default: null },
    enabled: { type: Boolean, default: true, index: true },
    enablement: { type: [EnablementSchema], default: [] }
  },
  { timestamps: true }
);

export const Connector = mongoose.model<ConnectorDocument>("Connector", ConnectorSchema);
