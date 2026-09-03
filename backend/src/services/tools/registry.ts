import { Connector, ConnectorDocument, ConnectorEnablement } from "../../models/Connector";
import { getAllBusinessUnits } from "../../config/businessUnits";
import { ToolContext } from "./types";
import { KNOWLEDGE_BASE_CONNECTOR_ID } from "./mcp/knowledgeBaseServer";
import { MICROSOFT_CONNECTOR_ID } from "./mcp/microsoftGraphServer";
import { hasMicrosoftIdentity, microsoftConnectorConfigured } from "./auth/microsoftAuth";
import { invalidateCatalogCache } from "./mcp/clientPool";
import logger from "../../utils/logger";

/**
 * The Connector Registry: which connectors exist, and who may see them.
 *
 * Visibility is decided here and nowhere else. The provider adapters and the tool
 * loop never make an access decision — they translate and they execute. That keeps
 * a single place to audit the question "could this user have called this tool", and
 * means adding a fifth LLM cannot introduce a fifth interpretation of the rules.
 */

/** Definition of a first-party server this deployment ships with. */
interface FirstPartyConnectorSeed {
  connectorId: string;
  label: string;
  description: string;
  dataEgress: "none" | "third_party";
  requiresIdentity: "microsoft" | null;
  /**
   * Whether the connector is live for a business unit as soon as it is seeded.
   *
   * Only ever true for a first-party read-only server over data the user can
   * already reach by other means — the knowledge base being the case in point,
   * where the tool changes how retrieval happens, not what is reachable. Anything
   * that leaves the deployment or can write waits for an admin.
   */
  autoApprove: boolean;
}

const FIRST_PARTY_SEEDS: FirstPartyConnectorSeed[] = [
  {
    connectorId: KNOWLEDGE_BASE_CONNECTOR_ID,
    label: "Knowledge Base",
    description:
      "Search and list the organization's approved internal documents. Runs inside Nexa; no data leaves the deployment.",
    dataEgress: "none",
    requiresIdentity: null,
    autoApprove: true
  },
  {
    connectorId: MICROSOFT_CONNECTOR_ID,
    label: "Microsoft 365",
    description:
      "Search and read the employee's own OneDrive and SharePoint files. Each user connects their own Microsoft account, so results never exceed what that person can already open. Queries and file contents transit Microsoft Graph.",
    dataEgress: "third_party",
    requiresIdentity: "microsoft",
    // Not auto-approved, unlike the knowledge base. This one sends queries and
    // document text to Microsoft, so a business unit's administrator decides whether
    // it goes live — that is exactly the judgement the approval gate exists for.
    autoApprove: false
  }
];

/**
 * Create or refresh the first-party connector rows.
 *
 * Idempotent, and deliberately non-destructive: descriptive fields are kept current
 * with the code, but an administrator's decisions — enablement, approval, write
 * scopes — are only ever written when the row or the business unit is new. A deploy
 * must not silently re-enable something an admin turned off.
 */
export async function bootstrapConnectors(): Promise<void> {
  const businessUnits = await getAllBusinessUnits();

  for (const seed of FIRST_PARTY_SEEDS) {
    const existing = await Connector.findOne({ connectorId: seed.connectorId });

    if (!existing) {
      await Connector.create({
        connectorId: seed.connectorId,
        label: seed.label,
        description: seed.description,
        kind: "first_party",
        dataEgress: seed.dataEgress,
        requiresIdentity: seed.requiresIdentity,
        transport: "in_memory",
        enabled: true,
        enablement: businessUnits.map((bu) => ({
          businessUnit: bu.name,
          enabled: true,
          writeEnabled: false,
          approved: seed.autoApprove,
          allowedDepartments: [],
          adminOnly: false
        }))
      });
      logger.info("[Connectors] Seeded first-party connector", {
        connector: seed.connectorId,
        businessUnits: businessUnits.length
      });
      continue;
    }

    // Keep copy in sync with the code, leave policy alone. dataEgress and
    // requiresIdentity are facts about the connector's implementation, not admin
    // decisions, so they are corrected on every boot — a connector that started
    // routing data somewhere new must not keep reporting the old answer.
    existing.label = seed.label;
    existing.description = seed.description;
    existing.dataEgress = seed.dataEgress;
    existing.requiresIdentity = seed.requiresIdentity;

    // A business unit created after the connector was seeded would otherwise never
    // get an enablement row, leaving the connector permanently invisible to it.
    const known = new Set(existing.enablement.map((e) => e.businessUnit));
    for (const bu of businessUnits) {
      if (known.has(bu.name)) continue;
      existing.enablement.push({
        businessUnit: bu.name,
        enabled: true,
        writeEnabled: false,
        approved: seed.autoApprove,
        allowedDepartments: [],
        adminOnly: false
      } as ConnectorEnablement);
    }

    await existing.save();
  }

  invalidateCatalogCache();
}

/** The enablement row governing this connector for this business unit, if any. */
export function enablementFor(
  connector: ConnectorDocument,
  businessUnit: string
): ConnectorEnablement | undefined {
  return connector.enablement.find((e) => e.businessUnit === businessUnit);
}

/**
 * Whether this user may see this connector at all.
 *
 * Every gate is a conjunction, and an absent enablement row is a "no" — a business
 * unit that was never configured for a connector does not get it by default.
 */
function isVisible(connector: ConnectorDocument, ctx: ToolContext): boolean {
  if (!connector.enabled) return false;

  const rule = enablementFor(connector, ctx.businessUnit);
  if (!rule) return false;
  if (!rule.enabled || !rule.approved) return false;
  if (rule.adminOnly && !ctx.isAdmin) return false;

  if (rule.allowedDepartments.length > 0) {
    // Admins are not bound by the department filter — they administer the unit
    // rather than belonging to one of its departments.
    if (ctx.isAdmin) return true;
    if (!ctx.department || !rule.allowedDepartments.includes(ctx.department)) return false;
  }

  return true;
}

/**
 * Whether this deployment could ever serve a connector needing this identity.
 *
 * Separate from whether the *user* has connected: a missing AZURE_CLIENT_ID is an
 * operator problem and the connector should not be offered to anyone, whereas an
 * unconnected user should be invited to connect.
 */
function identityProviderConfigured(requirement: ConnectorDocument["requiresIdentity"]): boolean {
  if (!requirement) return true;
  if (requirement === "microsoft") return microsoftConnectorConfigured();
  return false;
}

/** Whether this specific user has granted the identity the connector needs. */
async function userHasIdentity(
  requirement: ConnectorDocument["requiresIdentity"],
  ctx: ToolContext
): Promise<boolean> {
  if (!requirement) return true;
  if (!ctx.userId) return false;
  if (requirement === "microsoft") return hasMicrosoftIdentity(ctx.userId);
  return false;
}

export interface ConnectorAvailability {
  /** Admin-approved, and the user has any identity it needs — tools can be offered. */
  usable: ConnectorDocument[];
  /**
   * Approved and configured, but this user has not connected their account yet.
   *
   * Kept apart from `usable` rather than merged or dropped. Its tools must not be
   * offered — they would fail on every call — but the assistant should still be able
   * to say "connect Microsoft 365 in your settings and I can search your files",
   * which it cannot do if the connector is invisible to it.
   */
  needsUserConnection: ConnectorDocument[];
}

/** Split the connectors visible to this user by whether they can actually be called. */
export async function connectorAvailability(ctx: ToolContext): Promise<ConnectorAvailability> {
  if (!ctx.businessUnit) return { usable: [], needsUserConnection: [] };

  const visible = (await Connector.find({ enabled: true })).filter(
    (c) => isVisible(c, ctx) && identityProviderConfigured(c.requiresIdentity)
  );

  const usable: ConnectorDocument[] = [];
  const needsUserConnection: ConnectorDocument[] = [];

  // Checked in parallel: each is an independent lookup, and a user with several
  // identity-backed connectors should not pay for them in series mid-turn.
  const checks = await Promise.all(
    visible.map(async (c) => ({ connector: c, ready: await userHasIdentity(c.requiresIdentity, ctx) }))
  );

  for (const { connector, ready } of checks) {
    (ready ? usable : needsUserConnection).push(connector);
  }

  return { usable, needsUserConnection };
}

/** Every connector this user may currently call. */
export async function connectorsForContext(ctx: ToolContext): Promise<ConnectorDocument[]> {
  return (await connectorAvailability(ctx)).usable;
}

/**
 * Providers cleared to invoke write-capable tools.
 *
 * DeepSeek and Kimi are excluded until their tool-calling has been benchmarked
 * against real connector workloads: an unreliable read is a bad answer, an
 * unreliable write is a bad answer plus a change in someone's ERP. They keep the
 * read half of every catalog. Widen this with WRITE_CAPABLE_PROVIDERS once there is
 * evidence, not before.
 */
const DEFAULT_WRITE_CAPABLE_PROVIDERS = ["gpt", "claude"];

function writeCapableProviders(): string[] {
  const raw = process.env.WRITE_CAPABLE_PROVIDERS;
  if (!raw) return DEFAULT_WRITE_CAPABLE_PROVIDERS;
  return raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether write tools may be offered for this connector, on this turn.
 *
 * Two independent conditions, both required: the business unit's admins have
 * enabled writes for the connector, and the model driving this turn is trusted with
 * them. Either one failing withholds the write tools from the catalog rather than
 * offering and refusing them — a tool the model was never shown cannot be attempted,
 * explained away, or reported to the user as something it tried.
 */
export function writeAllowed(connector: ConnectorDocument, ctx: ToolContext): boolean {
  const rule = enablementFor(connector, ctx.businessUnit);
  if (!rule?.writeEnabled) return false;
  return writeCapableProviders().includes(ctx.provider.toLowerCase());
}
