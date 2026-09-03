/**
 * The canonical tool vocabulary every part of Nexa agrees on.
 *
 * Four providers, one representation. The shape below is deliberately close to
 * JSON Schema function-calling: OpenAI, DeepSeek and Kimi speak that natively, so
 * only Anthropic needs real translation (see adapters/anthropicShape.ts). Nothing
 * outside `adapters/` and the provider services may reference a vendor tool type.
 *
 * The Connector Gateway talks MCP outwards and this vocabulary inwards; adapters
 * exist only at the last hop, immediately before and after a model call.
 */

/** JSON Schema for a tool's argument object. Kept loose — it is passed through verbatim. */
export interface JsonSchemaObject {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

/**
 * Whether a tool only reads, or can change something in the source system.
 *
 * This is the axis every governance control turns on — admin read-only overrides,
 * per-role gating, and the rule that a provider not yet trusted with writes gets
 * the read half of a connector's catalog and nothing more.
 */
export type ToolAccess = "read" | "write";

/** One callable tool, already resolved for a specific user and business unit. */
export interface CanonicalTool {
  /**
   * Provider-facing name, qualified as `<connector>__<tool>`.
   *
   * Qualified because two connectors may each expose `search`, and the model is
   * handed one flat namespace. All four providers accept `[a-zA-Z0-9_-]{1,64}`,
   * which is what qualifyToolName() guarantees.
   */
  name: string;
  description: string;
  parameters: JsonSchemaObject;
  /** Human phrasing shown to the user while the call runs, e.g. "Searching the knowledge base". */
  label: string;
  /** The tool's unqualified name on its own MCP server — what we call back with. */
  remoteName: string;
  connectorId: string;
  connectorLabel: string;
  access: ToolAccess;
}

/**
 * Who is asking, and under whose authority.
 *
 * Carried through every layer down to the MCP call so the source system sees the
 * end user's own permissions, never Nexa's. `provider` is here only so the audit
 * trail records which of the four models drove the turn.
 */
export interface ToolContext {
  userId?: string;
  adminId?: string;
  email?: string;
  businessUnit: string;
  department?: string;
  isAdmin: boolean;
  provider: string;
}

/** Outcome of one tool call. */
export interface ToolExecutionResult {
  ok: boolean;
  /** Text handed back to the model. On failure, an explanation it can act on. */
  content: string;
  /** One-line summary for the UI pill — never the full payload. */
  summary: string;
}

/**
 * What a provider stream yields.
 *
 * Providers used to yield bare strings, which left no way for a tool call to reach
 * the client. Tool calls are surfaced rather than hidden because a user who sees
 * "Searching the knowledge base" understands a pause that would otherwise look
 * like a hang — and because approving a write action later needs this channel.
 */
export type StreamEvent =
  | { type: "text"; text: string }
  | {
      type: "tool_call";
      callId: string;
      tool: string;
      connector: string;
      connectorLabel: string;
      /** Human phrasing for the UI, e.g. "Searching the knowledge base". */
      label: string;
      args: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      callId: string;
      tool: string;
      connector: string;
      ok: boolean;
      summary: string;
      durationMs: number;
    };

/** Convenience guard — most consumers only care about the text. */
export function isTextEvent(e: StreamEvent): e is { type: "text"; text: string } {
  return e.type === "text";
}

/**
 * Hard ceiling on tool round-trips within a single turn.
 *
 * Each iteration is a full model call with the whole conversation attached, so an
 * unbounded loop is both a cost and a latency incident. Six is enough for a
 * search-then-read-then-answer chain with room to retry a bad argument once.
 */
export const MAX_TOOL_ITERATIONS = 6;

/** Provider tool-name limit shared by all four providers. */
const MAX_TOOL_NAME_LENGTH = 64;

const NAME_SEPARATOR = "__";

/** Reduce an arbitrary identifier to the character class every provider accepts. */
function sanitizeNamePart(part: string): string {
  return part
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

/**
 * Build the flat, provider-safe name for a connector's tool.
 *
 * Truncation favours the tool name over the connector slug: if something has to be
 * cut, an ambiguous connector is recoverable (unqualifyToolName resolves against the
 * live catalog) but an ambiguous tool name is not.
 */
export function qualifyToolName(connectorSlug: string, toolName: string): string {
  const tool = sanitizeNamePart(toolName);
  const connector = sanitizeNamePart(connectorSlug);
  const budget = MAX_TOOL_NAME_LENGTH - NAME_SEPARATOR.length - tool.length;
  if (budget <= 0) return tool.slice(0, MAX_TOOL_NAME_LENGTH);
  return `${connector.slice(0, budget)}${NAME_SEPARATOR}${tool}`;
}
