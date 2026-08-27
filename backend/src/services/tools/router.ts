import { ConnectorDocument } from "../../models/Connector";
import { logEvent } from "../auditService";
import { connectorsForContext, writeAllowed } from "./registry";
import { callConnectorTool, listConnectorTools } from "./mcp/clientPool";
import {
  CanonicalTool,
  JsonSchemaObject,
  ToolContext,
  ToolExecutionResult,
  qualifyToolName
} from "./types";
import logger from "../../utils/logger";

/**
 * The Tool Router.
 *
 * Two jobs: tell the orchestrator which tools a given user may be offered this
 * turn, and execute one when a model asks for it. Both answers are computed from
 * the registry, never from anything the model said — the only thing taken from the
 * model is the tool name and its arguments, and even the name is re-authorized
 * before it runs.
 */

/** How a tool call is phrased for the user while it runs. */
const TOOL_LABELS: Record<string, string> = {
  search_documents: "Searching the knowledge base",
  list_documents: "Checking available documents"
};

function labelFor(connector: ConnectorDocument, remoteName: string): string {
  const known = TOOL_LABELS[remoteName];
  if (known) return known;
  // Readable fallback: "get_file_metadata" on Google Drive reads as
  // "Google Drive: get file metadata".
  return `${connector.label}: ${remoteName.replace(/_/g, " ")}`;
}

/**
 * The tools this user may be offered, across every connector available to them.
 *
 * Failures are absorbed per connector rather than per turn: a dead MCP server
 * contributes nothing to the catalog, and the turn continues with the rest. That is
 * the right trade for a chat request — a smaller catalog degrades the answer, a
 * thrown error loses it.
 */
export async function resolveToolCatalog(ctx: ToolContext): Promise<CanonicalTool[]> {
  const connectors = await connectorsForContext(ctx);
  if (connectors.length === 0) return [];

  const perConnector = await Promise.all(
    connectors.map(async (connector) => {
      const allowWrites = writeAllowed(connector, ctx);
      const remoteTools = await listConnectorTools(connector);

      return remoteTools
        .filter((tool) => tool.access === "read" || allowWrites)
        .map((tool): CanonicalTool => ({
          name: qualifyToolName(connector.connectorId, tool.name),
          description: tool.description,
          parameters: normalizeParameters(tool.inputSchema),
          label: labelFor(connector, tool.name),
          remoteName: tool.name,
          connectorId: connector.connectorId,
          connectorLabel: connector.label,
          access: tool.access
        }));
    })
  );

  const catalog = perConnector.flat();

  // Two connectors can produce the same qualified name once names are truncated to
  // the 64-character provider limit. Dropping the duplicate is the only safe move:
  // sending both would let the model call one and reach the other.
  const seen = new Set<string>();
  const deduped = catalog.filter((tool) => {
    if (seen.has(tool.name)) {
      logger.warn("[ToolRouter] Dropped colliding tool name", {
        name: tool.name,
        connector: tool.connectorId
      });
      return false;
    }
    seen.add(tool.name);
    return true;
  });

  /**
   * Sorted, because the tool list is part of the prompt-cache prefix on every
   * provider — it renders ahead of the system prompt. Mongo does not promise a
   * document order, so an unsorted catalog would reshuffle between turns and
   * invalidate the cached prefix on each one: a large, silent cost increase with
   * nothing in the logs pointing at it.
   */
  deduped.sort((a, b) => a.name.localeCompare(b.name));

  logger.info("[ToolRouter] Catalog resolved", {
    businessUnit: ctx.businessUnit,
    provider: ctx.provider,
    connectors: connectors.length,
    tools: deduped.length
  });

  return deduped;
}

/**
 * Coerce an MCP server's declared input schema into the canonical object shape.
 *
 * Every provider requires the top level to be an object schema. A server that
 * declares something else would be rejected by the provider with an opaque 400, so
 * it is normalized to an empty object schema here instead.
 */
function normalizeParameters(schema: Record<string, unknown>): JsonSchemaObject {
  if (schema && schema.type === "object") return schema as JsonSchemaObject;
  return { type: "object", properties: {} };
}

/** One-line summary of a result for the UI pill, never the payload itself. */
function summarize(ok: boolean, text: string): string {
  if (!ok) return "failed";
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "done";
  return firstLine.length > 90 ? `${firstLine.slice(0, 90)}…` : firstLine;
}

/**
 * Execute a tool the model asked for.
 *
 * The catalog is rebuilt here rather than trusted from the caller. The model's
 * requested name is matched against tools this user may currently use, so a name it
 * invented, remembered from an earlier turn, or was talked into by injected document
 * text resolves to nothing and never reaches a connector. Re-resolving also means a
 * connector an admin disabled mid-conversation stops working on the next call rather
 * than at the end of the session.
 */
export async function executeTool(
  requestedName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolExecutionResult> {
  const started = Date.now();
  const catalog = await resolveToolCatalog(ctx);
  const tool = catalog.find((t) => t.name === requestedName);

  if (!tool) {
    logEvent("connector_tool_denied", {
      userId: ctx.userId,
      adminId: ctx.adminId,
      adminEmail: ctx.email,
      businessUnit: ctx.businessUnit,
      action: "Connector Tool Denied",
      details: `Model requested unavailable tool "${requestedName}"`,
      metadata: { requestedName, provider: ctx.provider }
    });

    return {
      ok: false,
      // Phrased for the model: it needs to stop retrying this name and either pick
      // a real one or tell the user it cannot do this.
      content: `The tool "${requestedName}" is not available to you. Do not try it again. Use one of the tools listed for this conversation, or tell the user this action is not available.`,
      summary: "not available"
    };
  }

  const connectors = await connectorsForContext(ctx);
  const connector = connectors.find((c) => c.connectorId === tool.connectorId);
  if (!connector) {
    return {
      ok: false,
      content: `The ${tool.connectorLabel} connector is no longer available.`,
      summary: "connector unavailable"
    };
  }

  const outcome = await callConnectorTool(connector, tool.remoteName, args, ctx);
  const durationMs = Date.now() - started;

  /**
   * Every call is audited, successful or not, and separately from the existing
   * document-access trail. A connector call is a different kind of event: it can
   * reach outside Nexa and it can change something, so a compliance review needs to
   * be able to read the connector history on its own rather than filtering it out of
   * knowledge-base queries.
   */
  logEvent("connector_tool_call", {
    userId: ctx.userId,
    adminId: ctx.adminId,
    adminEmail: ctx.email,
    businessUnit: ctx.businessUnit,
    action: outcome.ok ? "Connector Tool Call" : "Connector Tool Failed",
    details: `${ctx.provider} called ${tool.name} on ${connector.label}`,
    metadata: {
      connector: connector.connectorId,
      connectorKind: connector.kind,
      tool: tool.remoteName,
      access: tool.access,
      provider: ctx.provider,
      ok: outcome.ok,
      durationMs,
      // Arguments are recorded because "which action" is not answerable without
      // them — deleting file A and file B are the same tool call otherwise.
      arguments: args
    }
  });

  return {
    ok: outcome.ok,
    content: outcome.text,
    summary: summarize(outcome.ok, outcome.text)
  };
}
