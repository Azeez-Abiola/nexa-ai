import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { requireCaller, CallerIdentity } from "./callerContext";
import { accessTokenForUser, ConnectorAuthError } from "../auth/microsoftAuth";
import { extractTextFromDocx } from "../../../utils/docxParser";
import { extractTextFromPdf } from "../../../utils/pdfParser";
import { extractTextFromXlsx } from "../../../utils/xlsxParser";
import logger from "../../../utils/logger";

/**
 * First-party MCP server over Microsoft Graph — OneDrive and SharePoint.
 *
 * First-party even though it reaches a third party: Nexa runs the server, so every
 * call passes through the Tool Router's RBAC check and lands in the audit log. The
 * data does leave the network (to Microsoft), which is recorded on the connector row
 * as `dataEgress` rather than inferred from where the server runs — the two are
 * different questions and conflating them would misreport residency.
 *
 * Permission inheritance is Graph's, not ours. Every request carries the employee's
 * own delegated token, so Graph returns exactly the files that person can already
 * open and nothing else. Nexa never holds a credential with more reach than the
 * person asking, which is the property a shared service account would destroy.
 *
 * Read-only throughout. The proposal's own risk register says to start connectors
 * read-only, and a write tool here would mean the assistant could alter documents in
 * the corporate SharePoint on the strength of a model's inference.
 */

export const MICROSOFT_CONNECTOR_ID = "microsoft_365";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const GRAPH_TIMEOUT_MS = 20_000;

const SEARCH_DEFAULT_LIMIT = 5;
const SEARCH_MAX_LIMIT = 15;

/**
 * Cap on extracted document text.
 *
 * A tool result is re-sent to the model on every later iteration of the turn, so an
 * unbounded 80-page contract is charged several times over and can push the actual
 * conversation out of the window. Truncation is announced in the text so the model
 * knows it is looking at part of a document and can say so.
 */
const FILE_TEXT_CHARS = 6_000;
const FILE_MAX_BYTES = 12 * 1024 * 1024;

const TOOL_DEFINITIONS = [
  {
    name: "search_files",
    description:
      "Search the user's Microsoft 365 files across OneDrive and SharePoint by " +
      "keyword. Returns file names, locations and links — not contents. Use " +
      "read_file afterwards to read one. Only ever returns files this user can " +
      "already open.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Keywords to search for in file names and contents."
        },
        limit: {
          type: "integer",
          description: `Maximum files to return (1-${SEARCH_MAX_LIMIT}). Defaults to ${SEARCH_DEFAULT_LIMIT}.`,
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
    name: "list_recent_files",
    description:
      "List the files this user opened or edited most recently in Microsoft 365. " +
      "Useful when the user refers to something they were 'just working on' without " +
      "naming it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "integer",
          description: `Maximum files to list (1-${SEARCH_MAX_LIMIT}). Defaults to ${SEARCH_DEFAULT_LIMIT}.`,
          minimum: 1,
          maximum: SEARCH_MAX_LIMIT
        }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true }
  },
  {
    name: "read_file",
    description:
      "Read the text of one Microsoft 365 file, given the itemId returned by " +
      "search_files or list_recent_files. Handles Word, Excel, PDF and plain text. " +
      "Long documents are truncated.",
    inputSchema: {
      type: "object" as const,
      properties: {
        itemId: {
          type: "string",
          description: "The itemId from a previous search_files or list_recent_files result."
        },
        driveId: {
          type: "string",
          description:
            "The driveId from the same result. Required for SharePoint files; omit for the user's own OneDrive."
        }
      },
      required: ["itemId"],
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

/** A Graph driveItem, reduced to what the model needs to act on it. */
interface FileRef {
  name: string;
  itemId: string;
  driveId?: string;
  webUrl?: string;
  location?: string;
  lastModified?: string;
  size?: number;
}

function renderFiles(files: FileRef[], heading: string): string {
  if (files.length === 0) return heading;
  const lines = files.map((f, i) => {
    const where = f.location ? ` — in ${f.location}` : "";
    const when = f.lastModified ? `, modified ${f.lastModified.slice(0, 10)}` : "";
    // itemId and driveId are included because read_file needs them; the model cannot
    // construct them and would otherwise have to guess.
    const handle = f.driveId ? `itemId=${f.itemId} driveId=${f.driveId}` : `itemId=${f.itemId}`;
    return `[${i + 1}] ${f.name}${where}${when}\n    ${handle}${f.webUrl ? `\n    ${f.webUrl}` : ""}`;
  });
  return `${heading}\n\n${lines.join("\n")}`;
}

async function graphGet<T>(token: string, path: string, params?: Record<string, unknown>): Promise<T> {
  const response = await axios.get<T>(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    timeout: GRAPH_TIMEOUT_MS
  });
  return response.data;
}

/**
 * Search via Graph's unified search endpoint.
 *
 * `/search/query` rather than `/me/drive/root/search` because it spans SharePoint
 * sites as well as the user's own OneDrive — searching only OneDrive would miss most
 * of what a business user means by "our files".
 */
async function searchFiles(token: string, query: string, limit: number): Promise<FileRef[]> {
  const body = {
    requests: [
      {
        entityTypes: ["driveItem"],
        query: { queryString: query },
        from: 0,
        size: limit,
        fields: ["name", "webUrl", "lastModifiedDateTime", "size", "parentReference", "id"]
      }
    ]
  };

  const response = await axios.post<{
    value?: Array<{ hitsContainers?: Array<{ hits?: Array<{ resource?: Record<string, any> }> }> }>;
  }>(`${GRAPH_BASE}/search/query`, body, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    timeout: GRAPH_TIMEOUT_MS
  });

  const hits = response.data.value?.[0]?.hitsContainers?.[0]?.hits ?? [];
  return hits
    .map((hit) => hit.resource)
    .filter((r): r is Record<string, any> => Boolean(r?.id))
    .map((r) => ({
      name: r.name ?? "(untitled)",
      itemId: r.id,
      driveId: r.parentReference?.driveId,
      webUrl: r.webUrl,
      location: r.parentReference?.siteId ? "SharePoint" : "OneDrive",
      lastModified: r.lastModifiedDateTime,
      size: r.size
    }));
}

async function listRecentFiles(token: string, limit: number): Promise<FileRef[]> {
  const data = await graphGet<{ value?: Array<Record<string, any>> }>(token, "/me/drive/recent", {
    $top: limit
  });
  return (data.value ?? []).slice(0, limit).map((r) => ({
    name: r.name ?? "(untitled)",
    itemId: r.id,
    driveId: r.parentReference?.driveId,
    webUrl: r.webUrl,
    location: r.parentReference?.path ? String(r.parentReference.path).replace("/drive/root:", "") || "OneDrive" : "OneDrive",
    lastModified: r.lastModifiedDateTime,
    size: r.size
  }));
}

/**
 * Turn a downloaded file into text.
 *
 * Reuses the same parsers the document-upload pipeline uses, so a Word file read
 * from SharePoint is extracted exactly as one uploaded by hand would be — one fewer
 * place for the two paths to disagree about what a document says.
 */
async function extractText(name: string, mimeType: string, buffer: Buffer): Promise<string> {
  const lower = name.toLowerCase();

  if (lower.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    return extractTextFromDocx(buffer);
  }
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") {
    return extractTextFromPdf(buffer);
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mimeType.includes("spreadsheetml")) {
    return extractTextFromXlsx(buffer);
  }
  if (
    mimeType.startsWith("text/") ||
    /\.(txt|md|csv|json|log|ya?ml|html?)$/i.test(lower)
  ) {
    return buffer.toString("utf8");
  }

  // Named explicitly rather than returning empty text, so the model reports "I can't
  // read that format" instead of "the file appears to be blank".
  throw new Error(
    `${name} is a format this connector cannot read as text (${mimeType || "unknown type"}). Word, Excel, PDF and plain text are supported.`
  );
}

async function readFile(
  token: string,
  itemId: string,
  driveId?: string
): Promise<string> {
  const basePath = driveId ? `/drives/${driveId}/items/${itemId}` : `/me/drive/items/${itemId}`;

  const meta = await graphGet<{ name?: string; size?: number; file?: { mimeType?: string } }>(
    token,
    basePath
  );
  const name = meta.name ?? "(untitled)";
  const mimeType = meta.file?.mimeType ?? "";

  if ((meta.size ?? 0) > FILE_MAX_BYTES) {
    return `${name} is ${(meta.size! / 1024 / 1024).toFixed(1)} MB, which is too large to read here. Open it directly instead.`;
  }

  const download = await axios.get<ArrayBuffer>(`${GRAPH_BASE}${basePath}/content`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: "arraybuffer",
    timeout: GRAPH_TIMEOUT_MS,
    maxContentLength: FILE_MAX_BYTES
  });

  const text = (await extractText(name, mimeType, Buffer.from(download.data))).trim();
  if (!text) return `${name} contains no readable text.`;

  if (text.length > FILE_TEXT_CHARS) {
    return `${name} (truncated to the first ${FILE_TEXT_CHARS} characters of ${text.length}):\n\n${text.slice(0, FILE_TEXT_CHARS)}…`;
  }
  return `${name}:\n\n${text}`;
}

/**
 * Turn a Graph failure into something the model can act on.
 *
 * Status codes matter here because the right next move differs: a 403 means stop and
 * tell the user, a 429 means the answer may still be reachable later, and a 404 on an
 * itemId the model supplied usually means it invented or stale-cached one.
 */
function describeGraphError(err: unknown, caller: CallerIdentity): string {
  if (err instanceof ConnectorAuthError) {
    return err.needsReconnect
      ? `${err.message} Tell the user to reconnect Microsoft 365 in their Nexa settings, and do not retry this tool.`
      : `${err.message} Answer from what you already have.`;
  }

  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 401) {
      return "Microsoft rejected the access token. Tell the user to reconnect Microsoft 365 in their Nexa settings, and do not retry.";
    }
    if (status === 403) {
      return "This user does not have permission to read that in Microsoft 365. Say so — do not retry, and do not attempt another route to the same file.";
    }
    if (status === 404) {
      return "No such file. The itemId may be stale — search again rather than reusing it.";
    }
    if (status === 429) {
      return "Microsoft is rate-limiting these requests. Answer with what you have and say the file search was throttled.";
    }
    logger.error("[MCP/Graph] Graph request failed", {
      status,
      businessUnit: caller.businessUnit
    });
    return `Microsoft 365 returned an error (${status ?? "no status"}). Answer from what you already have and say the file lookup failed.`;
  }

  return `The Microsoft 365 lookup failed: ${err instanceof Error ? err.message : String(err)}`;
}

export function createMicrosoftGraphServer(): Server {
  const server = new Server(
    { name: "nexa-microsoft-365", version: "1.0.0" },
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

    if (!caller.userId) {
      // Graph is always called with a delegated user token, so there is no meaningful
      // way to serve a call with no user behind it.
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Microsoft 365 tools need an individual user account and cannot be used here."
          }
        ]
      };
    }

    try {
      const token = await accessTokenForUser(caller.userId);
      let text: string;

      switch (request.params.name) {
        case "search_files": {
          const query = String(args.query ?? "").trim();
          if (!query) {
            return {
              isError: true,
              content: [{ type: "text", text: "No query supplied. Call search_files again with a `query`." }]
            };
          }
          const limit = clampLimit(args.limit, SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT);
          const files = await searchFiles(token, query, limit);
          text = renderFiles(
            files,
            files.length
              ? `${files.length} file(s) matching "${query}":`
              : `No Microsoft 365 files matched "${query}". Either nothing matches, or it is somewhere this user cannot see.`
          );
          break;
        }

        case "list_recent_files": {
          const limit = clampLimit(args.limit, SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT);
          const files = await listRecentFiles(token, limit);
          text = renderFiles(
            files,
            files.length ? `${files.length} recently used file(s):` : "No recent Microsoft 365 files for this user."
          );
          break;
        }

        case "read_file": {
          const itemId = String(args.itemId ?? "").trim();
          if (!itemId) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: "No itemId supplied. Use search_files or list_recent_files first, then pass the itemId it returned."
                }
              ]
            };
          }
          const driveId = args.driveId ? String(args.driveId).trim() : undefined;
          text = await readFile(token, itemId, driveId || undefined);
          break;
        }

        default:
          return {
            isError: true,
            content: [{ type: "text", text: `Unknown tool "${request.params.name}".` }]
          };
      }

      logger.info("[MCP/Graph] Tool call", {
        tool: request.params.name,
        businessUnit: caller.businessUnit,
        durationMs: Date.now() - started
      });

      return { content: [{ type: "text", text }] };
    } catch (err) {
      const message = describeGraphError(err, caller);
      logger.warn("[MCP/Graph] Tool call failed", {
        tool: request.params.name,
        businessUnit: caller.businessUnit,
        durationMs: Date.now() - started,
        reason: err instanceof Error ? err.message : String(err)
      });
      return { isError: true, content: [{ type: "text", text: message }] };
    }
  });

  return server;
}
