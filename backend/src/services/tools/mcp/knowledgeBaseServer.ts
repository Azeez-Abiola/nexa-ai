import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { Types } from "mongoose";
import { RagDocument } from "../../../models/RagDocument";
import { KnowledgeGroup } from "../../../models/KnowledgeGroup";
import { retrieveRelevantChunks } from "../../ragService";
import { requireCaller, CallerIdentity } from "./callerContext";
import logger from "../../../utils/logger";

/**
 * First-party MCP server over Nexa's own knowledge base.
 *
 * This is the pilot connector, and it is first-party on purpose. Every other
 * connector needs an OAuth app registered with a third party before a single line
 * of it can be tested; this one exercises the entire gateway — canonical schema,
 * four provider adapters, MCP client, tool router, audit trail — against a store
 * Nexa already owns, so the hard part is proven before any external dependency is
 * introduced.
 *
 * It also changes what the assistant can do with the knowledge base. Retrieval
 * today happens once, before the model runs: one query, one context block, and if
 * the query was wrong the model has no recourse. As a tool, the model can search
 * again with better terms, check what exists before claiming something doesn't, and
 * follow up on what it finds.
 *
 * Permission inheritance is not reimplemented here. `retrieveRelevantChunks`
 * already enforces knowledge-group membership and business-unit scoping, and
 * `list_documents` applies the same group filter the suggestions endpoint does — so
 * a tool call can only surface what its caller could already retrieve.
 */

export const KNOWLEDGE_BASE_CONNECTOR_ID = "knowledge_base";

const SEARCH_DEFAULT_LIMIT = 5;
const SEARCH_MAX_LIMIT = 10;
const LIST_MAX_LIMIT = 25;
/**
 * Chunks are truncated per result because this text is re-sent to the model on
 * every subsequent iteration of the tool loop. Five untruncated chunks across three
 * iterations is a large multiple of the context the old single-shot path used.
 */
const CHUNK_EXCERPT_CHARS = 1200;

const TOOL_DEFINITIONS = [
  {
    name: "search_documents",
    description:
      "Search the organization's approved internal documents (policies, procedures, " +
      "handbooks, contracts, reports) and return the most relevant passages. Use this " +
      "whenever the answer might be in company documentation, and search again with " +
      "different wording if the first attempt returns nothing useful. Only returns " +
      "documents the asking user is permitted to read.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "What to look for, in natural language. Specific phrasing drawn from the " +
            "user's question works better than a single keyword."
        },
        limit: {
          type: "integer",
          description: `Maximum passages to return (1-${SEARCH_MAX_LIMIT}). Defaults to ${SEARCH_DEFAULT_LIMIT}.`,
          minimum: 1,
          maximum: SEARCH_MAX_LIMIT
        }
      },
      required: ["query"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: true }
  },
  {
    name: "list_documents",
    description:
      "List the internal documents available to the asking user, newest first. Use " +
      "this to find out what documentation exists before telling the user something " +
      "is not documented, or when they ask what the knowledge base contains.",
    inputSchema: {
      type: "object" as const,
      properties: {
        documentType: {
          type: "string",
          description:
            "Optional filter, one of: policy, procedure, handbook, contract, report, other."
        },
        limit: {
          type: "integer",
          description: `Maximum documents to list (1-${LIST_MAX_LIMIT}). Defaults to 10.`,
          minimum: 1,
          maximum: LIST_MAX_LIMIT
        }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true }
  }
] as const;

function clampLimit(raw: unknown, fallback: number, max: number): number {
  const n = typeof raw === "number" ? Math.floor(raw) : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/**
 * The group-access filter for whole documents.
 *
 * Mirrors the rule chunk retrieval applies: a document with no group restriction is
 * open to the business unit, and a restricted one needs the user in one of its
 * groups. Kept in sync deliberately — a document that cannot be retrieved must not
 * be listed either, or the listing becomes a directory of things the user is about
 * to be refused.
 */
async function accessibleDocumentFilter(caller: CallerIdentity): Promise<Record<string, unknown>[]> {
  const groupOr: Record<string, unknown>[] = [
    { allowedGroupIds: { $exists: false } },
    { allowedGroupIds: { $size: 0 } }
  ];

  if (caller.userId && Types.ObjectId.isValid(caller.userId)) {
    const groups = await KnowledgeGroup.find({
      businessUnit: caller.businessUnit,
      memberUserIds: new Types.ObjectId(caller.userId)
    })
      .select("_id")
      .lean();
    const ids = groups.map((g) => g._id as Types.ObjectId);
    if (ids.length > 0) groupOr.push({ allowedGroupIds: { $in: ids } });
  }

  return groupOr;
}

async function searchDocuments(
  caller: CallerIdentity,
  args: Record<string, unknown>
): Promise<string> {
  const query = String(args.query ?? "").trim();
  if (!query) return "No query was supplied. Call this tool again with a `query`.";

  const limit = clampLimit(args.limit, SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT);

  const result = await retrieveRelevantChunks({
    query,
    businessUnit: caller.businessUnit,
    userId: caller.userId,
    userDepartment: caller.department,
    topK: limit
  });

  if (result.chunks.length === 0) {
    // Said plainly, because the useful next move differs from an error: there is
    // nothing to retry here, and the model should stop searching and say so.
    return `No passages in the knowledge base matched "${query}". The knowledge base has no documentation on this, or it is worded differently — try list_documents to see what exists.`;
  }

  const rendered = result.chunks
    .map((chunk, i) => {
      const body =
        chunk.content.length > CHUNK_EXCERPT_CHARS
          ? `${chunk.content.slice(0, CHUNK_EXCERPT_CHARS)}…`
          : chunk.content;
      const version = chunk.version ? ` v${chunk.version}` : "";
      return [
        `[${i + 1}] ${chunk.documentTitle}${version} (${chunk.documentType}, relevance ${chunk.score.toFixed(2)})`,
        body
      ].join("\n");
    })
    .join("\n\n");

  return `${result.chunks.length} passage(s) for "${query}":\n\n${rendered}`;
}

async function listDocuments(
  caller: CallerIdentity,
  args: Record<string, unknown>
): Promise<string> {
  const limit = clampLimit(args.limit, 10, LIST_MAX_LIMIT);
  const documentType = String(args.documentType ?? "").trim();

  const docs = await RagDocument.find({
    businessUnit: caller.businessUnit,
    isLatestVersion: true,
    processingStatus: "completed",
    ...(documentType ? { documentType } : {}),
    $or: await accessibleDocumentFilter(caller)
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("title documentType createdAt")
    .lean();

  if (docs.length === 0) {
    return documentType
      ? `No documents of type "${documentType}" are available to this user.`
      : "No documents are available to this user in the knowledge base.";
  }

  const rendered = docs
    .map((d: { title: string; documentType: string; createdAt?: Date }) => {
      const added = d.createdAt ? ` — added ${new Date(d.createdAt).toISOString().slice(0, 10)}` : "";
      return `- ${d.title} (${d.documentType})${added}`;
    })
    .join("\n");

  return `${docs.length} document(s) available:\n${rendered}`;
}

/**
 * Build the knowledge-base MCP server.
 *
 * A fresh instance per connection, not a shared singleton: an MCP Server binds to
 * one transport, and the pool may reconnect after a failure. The server holds no
 * per-user state — identity arrives with each call in `_meta` — so instances are
 * interchangeable.
 */
export function createKnowledgeBaseServer(): Server {
  const server = new Server(
    { name: "nexa-knowledge-base", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: t.annotations
    }))
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const caller = requireCaller(request.params._meta);
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const started = Date.now();

    try {
      let text: string;
      switch (request.params.name) {
        case "search_documents":
          text = await searchDocuments(caller, args);
          break;
        case "list_documents":
          text = await listDocuments(caller, args);
          break;
        default:
          // Reported as a tool error rather than thrown: the model chose the name,
          // and telling it the name is wrong is more useful than a transport failure.
          return {
            isError: true,
            content: [{ type: "text", text: `Unknown tool "${request.params.name}".` }]
          };
      }

      logger.info("[MCP/KnowledgeBase] Tool call", {
        tool: request.params.name,
        businessUnit: caller.businessUnit,
        durationMs: Date.now() - started
      });

      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("[MCP/KnowledgeBase] Tool call failed", {
        tool: request.params.name,
        businessUnit: caller.businessUnit,
        error: message
      });
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `The knowledge base search failed: ${message}. Answer from what you already have, and tell the user the knowledge base was unreachable.`
          }
        ]
      };
    }
  });

  return server;
}
