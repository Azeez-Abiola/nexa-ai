import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ConnectorDocument } from "../../../models/Connector";
import { ToolAccess, ToolContext } from "../types";
import { callerMeta } from "./callerContext";
import { createKnowledgeBaseServer, KNOWLEDGE_BASE_CONNECTOR_ID } from "./knowledgeBaseServer";
import { createMicrosoftGraphServer, MICROSOFT_CONNECTOR_ID } from "./microsoftGraphServer";
import logger from "../../../utils/logger";

/**
 * The MCP client pool.
 *
 * One authenticated session per connected MCP server, held open across chat turns
 * because the handshake costs a round trip that no user should pay for mid-answer.
 * Two transports are supported: in-process for first-party servers Nexa runs itself,
 * and Streamable HTTP for remote servers. Callers above this file never learn which
 * — that distinction exists for data-residency reporting, not for behaviour.
 */

/** A tool as the MCP server describes it, before qualification for a provider. */
export interface RemoteTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  access: ToolAccess;
}

interface PooledSession {
  client: Client;
  /** Cached tools/list result and when it was taken. */
  catalog?: { tools: RemoteTool[]; fetchedAt: number };
}

/**
 * Tool Catalog Cache TTL.
 *
 * `tools/list` on every chat turn would put a network round trip per connector in
 * front of every message, for a catalog that changes when someone deploys a server —
 * not between turns. Five minutes bounds how long a newly deployed tool stays
 * invisible while removing the per-turn cost entirely.
 */
const CATALOG_TTL_MS = 5 * 60 * 1000;

const CALL_TIMEOUT_MS = 30_000;

const sessions = new Map<string, PooledSession>();

/** In-flight connects, so N concurrent turns on a cold connector open one session. */
const connecting = new Map<string, Promise<PooledSession>>();

/**
 * Factories for first-party servers, keyed by connector id.
 *
 * First-party servers run in-process over a linked in-memory transport. It is real
 * MCP — real client, real server, real JSON-RPC framing, so the same client code
 * path serves both kinds — without a child process to supervise or a port to
 * expose for something that never leaves the deployment.
 */
const FIRST_PARTY_SERVERS: Record<string, () => Server> = {
  [KNOWLEDGE_BASE_CONNECTOR_ID]: createKnowledgeBaseServer,
  // First-party in the sense that matters here — Nexa runs it, so its calls pass the
  // RBAC check and reach the audit log — even though it talks to Microsoft. Where the
  // data goes is recorded on the connector row as `dataEgress`.
  [MICROSOFT_CONNECTOR_ID]: createMicrosoftGraphServer
};

/**
 * Classify a tool as read or write from its MCP annotations.
 *
 * A missing `readOnlyHint` is treated as write-capable. That is the safe direction:
 * an unannotated read tool is merely withheld until an admin enables writes, whereas
 * an unannotated write tool assumed to be read-only would let a model mutate a
 * third-party system under a read-only policy. The hint is also just a hint — it
 * comes from the server, so it can lower a tool's privilege but never raise it past
 * what the business unit's own settings allow.
 */
function classifyAccess(annotations: unknown): ToolAccess {
  const readOnly = (annotations as { readOnlyHint?: unknown } | undefined)?.readOnlyHint;
  return readOnly === true ? "read" : "write";
}

async function openSession(connector: ConnectorDocument): Promise<PooledSession> {
  const client = new Client(
    { name: "nexa-connector-gateway", version: "1.0.0" },
    { capabilities: {} }
  );

  if (connector.transport === "in_memory") {
    const factory = FIRST_PARTY_SERVERS[connector.connectorId];
    if (!factory) {
      throw new Error(`No first-party MCP server registered for "${connector.connectorId}"`);
    }
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = factory();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  } else {
    if (!connector.endpoint) {
      throw new Error(`Connector "${connector.connectorId}" is remote but has no endpoint`);
    }
    await client.connect(new StreamableHTTPClientTransport(new URL(connector.endpoint)));
  }

  logger.info("[MCP/Pool] Session opened", {
    connector: connector.connectorId,
    transport: connector.transport,
    kind: connector.kind
  });

  return { client };
}

async function getSession(connector: ConnectorDocument): Promise<PooledSession> {
  const existing = sessions.get(connector.connectorId);
  if (existing) return existing;

  const pending = connecting.get(connector.connectorId);
  if (pending) return pending;

  const attempt = openSession(connector)
    .then((session) => {
      sessions.set(connector.connectorId, session);
      return session;
    })
    .finally(() => {
      connecting.delete(connector.connectorId);
    });

  connecting.set(connector.connectorId, attempt);
  return attempt;
}

/** Drop a session so the next call reconnects. Used when a call fails on transport. */
function dropSession(connectorId: string): void {
  const session = sessions.get(connectorId);
  sessions.delete(connectorId);
  if (!session) return;
  // Best-effort: the session is already considered dead, and a failing close must
  // not mask the original error.
  void session.client.close().catch(() => undefined);
}

/**
 * The connector's tool catalog, from cache when warm.
 *
 * Returns an empty list rather than throwing when a server is unreachable: one dead
 * connector must not take down a chat turn that three healthy ones could still
 * serve. The turn proceeds with a smaller catalog, and the failure is logged.
 */
export async function listConnectorTools(connector: ConnectorDocument): Promise<RemoteTool[]> {
  try {
    const session = await getSession(connector);

    if (session.catalog && Date.now() - session.catalog.fetchedAt < CATALOG_TTL_MS) {
      return session.catalog.tools;
    }

    const result = await session.client.listTools();
    const tools: RemoteTool[] = result.tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema ?? { type: "object" }) as Record<string, unknown>,
      access: classifyAccess(t.annotations)
    }));

    session.catalog = { tools, fetchedAt: Date.now() };
    return tools;
  } catch (err) {
    dropSession(connector.connectorId);
    logger.error("[MCP/Pool] Failed to list tools", {
      connector: connector.connectorId,
      error: err instanceof Error ? err.message : String(err)
    });
    return [];
  }
}

export interface McpCallOutcome {
  ok: boolean;
  text: string;
}

/**
 * Invoke a tool on its MCP server.
 *
 * Caller identity goes in `_meta` (see callerContext.ts) so the server can enforce
 * the end user's own permissions. Failures come back as `ok: false` with a readable
 * message rather than an exception, because the model is the one that has to recover
 * — it needs to be told the call failed, in text, in order to say so or try again.
 */
export async function callConnectorTool(
  connector: ConnectorDocument,
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<McpCallOutcome> {
  let session: PooledSession;
  try {
    session = await getSession(connector);
  } catch (err) {
    dropSession(connector.connectorId);
    return {
      ok: false,
      text: `The ${connector.label} connector is unavailable: ${
        err instanceof Error ? err.message : String(err)
      }`
    };
  }

  try {
    const result = await session.client.callTool(
      { name: toolName, arguments: args, _meta: callerMeta(ctx) },
      undefined,
      { timeout: CALL_TIMEOUT_MS }
    );

    const text = (Array.isArray(result.content) ? result.content : [])
      .filter((block: unknown) => (block as { type?: string })?.type === "text")
      .map((block: unknown) => (block as { text?: string }).text ?? "")
      .join("\n")
      .trim();

    // `isError` is the server reporting a failed action over a successful transport
    // — a bad argument, a permission refusal. The text is the model's cue to adapt.
    if (result.isError) {
      return { ok: false, text: text || `${toolName} reported an error.` };
    }

    return { ok: true, text: text || `${toolName} returned no content.` };
  } catch (err) {
    // Transport-level failure: the session may be broken, so retire it.
    dropSession(connector.connectorId);
    const message = err instanceof Error ? err.message : String(err);
    logger.error("[MCP/Pool] Tool call failed", {
      connector: connector.connectorId,
      tool: toolName,
      error: message
    });
    return { ok: false, text: `${connector.label} could not be reached: ${message}` };
  }
}

/** Forget every cached catalog — called when an admin changes connector settings. */
export function invalidateCatalogCache(): void {
  for (const session of sessions.values()) session.catalog = undefined;
}

/** Close every session. Used on shutdown so in-flight transports do not leak. */
export async function closeAllSessions(): Promise<void> {
  const open = [...sessions.values()];
  sessions.clear();
  await Promise.all(open.map((session) => session.client.close().catch(() => undefined)));
}
