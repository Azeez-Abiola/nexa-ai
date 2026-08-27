import Anthropic from "@anthropic-ai/sdk";
import { getBusinessUnitLabel } from "../config/businessUnits";
import { buildSystemPrompt } from "./openaiService";
import { PolicyContext, ImageAttachment, WebSource } from "./openaiService";
import logger from "../utils/logger";
import { recordUsage } from "./usageService";
import { isRetryableFailure, retryDelayMs } from "./providerHealth";
import { toAnthropicTools, parseAnthropicToolCalls, anthropicToolResultMessage } from "./tools/adapters/anthropicShape";
import { CompletedToolCall, runToolCalls } from "./tools/loop";
import { resolveToolCatalog } from "./tools/router";
import { MAX_TOOL_ITERATIONS, StreamEvent, ToolContext } from "./tools/types";

if (!process.env.ANTHROPIC_API_KEY) {
  logger.warn("[ClaudeService] ANTHROPIC_API_KEY not set — Claude requests will fail at runtime");
}

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

const STREAM_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const STREAM_TIMEOUT_MS   = 90_000;

// Native (hosted) web search — Claude runs the search server-side and returns cited text.
const WEB_SEARCH_ENABLED  = process.env.WEB_SEARCH_ENABLED !== "false";
const WEB_SEARCH_MAX_USES = Number(process.env.WEB_SEARCH_MAX_USES) || 3;

/** Hosted web-search tool, or empty array when disabled. */
function webSearchTools(): Anthropic.Messages.ToolUnion[] {
  if (!WEB_SEARCH_ENABLED) return [];
  return [{ type: "web_search_20250305", name: "web_search", max_uses: WEB_SEARCH_MAX_USES }];
}

/** Push a deduped web citation (by url) into the collector. */
function collectWebSource(collector: WebSource[] | undefined, url: unknown, title: unknown): void {
  if (!collector) return;
  const link = typeof url === "string" ? url.trim() : "";
  if (!link || collector.some((s) => s.link === link)) return;
  collector.push({ link, title: (typeof title === "string" && title.trim()) || link });
}

/** Extract citations from web_search_tool_result content blocks into the collector. */
function collectSourcesFromContent(content: unknown, collector: WebSource[] | undefined): void {
  if (!collector || !Array.isArray(content)) return;
  for (const block of content as any[]) {
    if (block?.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r?.type === "web_search_result") collectWebSource(collector, r.url, r.title);
      }
    }
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  imageUrls?: string[];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  // Shared classifier: retries only transient failures (rate limits, 5xx,
  // transport blips) and never an exhausted quota or bad key. Also honours
  // `retry-after` — see providerHealth.ts.
  return isRetryableFailure(err);
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.message.includes("aborted") || err.name === "AbortError");
}

// Strip accidental ```json``` fences Claude may add despite being told not to
function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

// ─── Prompt Caching ───────────────────────────────────────────────────────────
//
// Caching is a prefix match over `tools` → `system` → `messages`; a single byte
// change anywhere invalidates everything after it. Two breakpoints are placed:
//
//   1. End of the system prompt — frozen text only (no retrieved policies).
//   2. End of the conversation history — grows and stays byte-stable per turn.
//
// Everything volatile (the RAG policy context and the current question) goes
// into the final user turn, after breakpoint 2, so it never invalidates either.
// Minimum cacheable prefix is 1024 tokens on Opus 4.x; shorter prefixes simply
// don't cache (no error, no write charge).

// TTL is chosen per breakpoint, because the two have opposite cost profiles.
// (The API offers only "5m" (default, 1.25x writes) and "1h" (2x writes) — there
// is no value in between.)
//
// System block: ~1.2k tokens, written once, read on every turn for the life of the
// conversation. Cheap to write, so the 1-hour TTL keeps it warm through long pauses.
const SYSTEM_CACHE_CONTROL: Anthropic.CacheControlEphemeral = { type: "ephemeral", ttl: "1h" };

// History block: grows every turn, so it is rewritten every turn — this is where the
// write premium actually lands. 5m keeps that at 1.25x instead of 2x. If a user pauses
// past the window, the still-warm system entry above absorbs part of the miss.
const HISTORY_CACHE_CONTROL: Anthropic.CacheControlEphemeral = { type: "ephemeral" };

/** Copy of a message with a cache breakpoint on its last content block. */
function withCacheBreakpoint(msg: Anthropic.MessageParam): Anthropic.MessageParam {
  const blocks: Anthropic.ContentBlockParam[] =
    typeof msg.content === "string"
      ? msg.content
        ? [{ type: "text", text: msg.content }]
        : []
      : [...msg.content];

  if (blocks.length === 0) return msg;

  blocks[blocks.length - 1] = {
    ...blocks[blocks.length - 1],
    cache_control: HISTORY_CACHE_CONTROL,
  } as Anthropic.ContentBlockParam;

  return { ...msg, content: blocks };
}

/** Log cache effectiveness — a persistently zero read count means an invalidator. */
function logCacheUsage(label: string, usage: Anthropic.Usage | undefined): void {
  if (!usage) return;
  logger.info(`[Claude/${label}] Cache usage`, {
    cacheRead:    usage.cache_read_input_tokens ?? 0,
    cacheWrite:   usage.cache_creation_input_tokens ?? 0,
    uncached:     usage.input_tokens,
    outputTokens: usage.output_tokens,
  });
}

// ─── Message Builder ──────────────────────────────────────────────────────────

function buildClaudeMessages(
  history: Message[],
  userMessage: string,
  imageAttachments?: ImageAttachment[],
  policyContext?: string
): Anthropic.MessageParam[] {
  const historyMessages: Anthropic.MessageParam[] = history
    .filter((m) => m.role !== "system")
    .map((m) => {
      if (m.role === "user" && m.imageUrls && m.imageUrls.length > 0) {
        const content: Anthropic.ContentBlockParam[] = [
          { type: "text", text: m.content || "" },
          ...m.imageUrls.map((url): Anthropic.ImageBlockParam => ({
            type: "image",
            source: { type: "url", url },
          })),
        ];
        return { role: "user" as const, content };
      }
      return { role: m.role as "user" | "assistant", content: m.content };
    });

  // Volatile content lives here, after the history breakpoint: the retrieved
  // policies change every turn and must never sit inside the cached prefix.
  const userContent: Anthropic.ContentBlockParam[] = [];

  if (policyContext) {
    userContent.push({ type: "text", text: policyContext });
  }

  const questionText = userMessage || (imageAttachments?.length ? "What is in this image?" : "");
  if (questionText) {
    userContent.push({ type: "text", text: questionText });
  }

  if (imageAttachments && imageAttachments.length > 0) {
    userContent.push(
      ...imageAttachments.map((img): Anthropic.ImageBlockParam => ({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: img.base64,
        },
      }))
    );
  }

  // Breakpoint 2: end of history. Skipped for the first turn (nothing to reuse).
  const cachedHistory =
    historyMessages.length > 0
      ? [
          ...historyMessages.slice(0, -1),
          withCacheBreakpoint(historyMessages[historyMessages.length - 1]),
        ]
      : historyMessages;

  return [...cachedHistory, { role: "user", content: userContent }];
}

/**
 * Renders the top-3 retrieved policies, or "" when there are none.
 *
 * This deliberately does NOT go into the system prompt: retrieval results change
 * on every turn, and system renders ahead of `messages`, so embedding them there
 * would invalidate the cached conversation prefix on each request. It is sent as
 * the first block of the current user turn instead — still "above" the question,
 * which is what the system prompt's citation rules refer to.
 */
function buildPolicyContext(policies: PolicyContext[]): string {
  const topPolicies = policies.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);
  if (topPolicies.length === 0) return "";

  let policyContext = "### Relevant Policies:\n";
  topPolicies.forEach((p, i) => {
    policyContext += `\n**${i + 1}. ${p.title}** *(${p.category})*\n${p.content}\n`;
  });
  return policyContext;
}

/**
 * Frozen system prompt carrying cache breakpoint 1.
 *
 * The only inputs are the business-unit label and whether policies were found —
 * so the rendered text takes one of a small number of stable values rather than
 * changing per request. Keep it that way: no timestamps, no user IDs, no
 * retrieved content.
 */
function buildSystem(
  businessUnit: string,
  buLabel: string | null,
  hasPolicies: boolean,
  customSystemPrompt?: string
): Anthropic.TextBlockParam[] {
  const name = buLabel || businessUnit || "your organization";
  const text = customSystemPrompt ?? buildSystemPrompt(name, "", hasPolicies, MODEL);
  return [{ type: "text", text, cache_control: SYSTEM_CACHE_CONTROL }];
}

// ─── generateAIResponse ───────────────────────────────────────────────────────

export async function generateAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "",
  customSystemPrompt?: string,
  webSources?: WebSource[]
): Promise<string> {
  const buLabel = await getBusinessUnitLabel(businessUnit);
  // customSystemPrompt callers opt out of policy context entirely (unchanged).
  const policyContext = customSystemPrompt ? "" : buildPolicyContext(policies);
  const system   = buildSystem(businessUnit, buLabel, Boolean(policyContext), customSystemPrompt);
  const messages = buildClaudeMessages(conversationHistory, userMessage, undefined, policyContext);
  const tools    = webSearchTools();

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  try {
    logger.info("[Claude/NonStream] Request", { model: MODEL, system: system.length, webSearch: tools.length > 0 });

    const response = await claude.messages.create(
      { model: MODEL, system, messages, max_tokens: 8192, ...(tools.length ? { tools } : {}) },
      { signal: controller.signal }
    );

    logCacheUsage("NonStream", response.usage);
    recordUsage({ businessUnit, provider: "claude", modelId: MODEL, usage: response.usage, mode: "generate" });
    collectSourcesFromContent(response.content, webSources);

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return text.trim() || "I couldn't generate a response. Please try again.";
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── streamAIResponse ─────────────────────────────────────────────────────────

/**
 * One model call, streamed.
 *
 * Split out from the tool loop because retries belong here and nowhere else: an
 * attempt that failed executed no tools, so replaying it is safe, whereas replaying
 * a whole loop iteration would re-run every tool call it contained.
 *
 * Returns the assembled message so the caller can read `stop_reason` and pull out
 * tool-use blocks. Returns null when the call failed without producing anything and
 * is not worth retrying.
 */
async function* streamOneTurn(
  system: Anthropic.TextBlockParam[],
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Messages.ToolUnion[],
  businessUnit: string,
  webSources: WebSource[] | undefined,
  hasYieldedGlobally: boolean
): AsyncGenerator<StreamEvent, Anthropic.Message | null, unknown> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < STREAM_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = retryDelayMs(lastError, attempt, RETRY_BASE_DELAY_MS);
      logger.warn("[Claude/Stream] Retrying after error", {
        attempt,
        delayMs,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      });
      await sleep(delayMs);
    }

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
    let yieldedThisAttempt = false;

    try {
      logger.info("[Claude/Stream] Request", { model: MODEL, attempt, tools: tools.length });

      const stream = claude.messages.stream(
        { model: MODEL, system, messages, max_tokens: 8192, ...(tools.length ? { tools } : {}) },
        { signal: controller.signal }
      );

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta" &&
          event.delta.text
        ) {
          yield { type: "text", text: event.delta.text };
          yieldedThisAttempt = true;
        }
      }

      const finalMessage = await stream.finalMessage();
      logCacheUsage("Stream", finalMessage.usage);
      recordUsage({ businessUnit, provider: "claude", modelId: MODEL, usage: finalMessage.usage, mode: "stream" });
      collectSourcesFromContent(finalMessage.content, webSources);
      return finalMessage;
    } catch (err) {
      clearTimeout(timeoutId);
      if (isAbortError(err)) throw new Error("Request timeout");
      // Output already committed to the client — nothing to retry onto.
      if (yieldedThisAttempt || hasYieldedGlobally) throw err;
      lastError = err;
      if (!isRetryableError(err)) break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError) {
    throw new Error(
      `Failed to generate Claude response: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }

  return null;
}

/**
 * Stream a response, executing connector tools as Claude asks for them.
 *
 * Two kinds of tool are in play at once and they are handled quite differently.
 * Hosted web search runs on Anthropic's servers and needs nothing from us but a
 * declaration. Connector tools are ours to execute, and arrive as `tool_use` blocks
 * that must be answered with `tool_result` blocks in a user-role message.
 *
 * Mixing them makes `pause_turn` a real case rather than a theoretical one: a long
 * hosted-search turn can stop early and expects the assistant turn to be handed back
 * to continue. Left unhandled it reads as a finished answer that stops mid-sentence,
 * with nothing in the logs to explain it.
 */
export async function* streamAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "",
  customSystemPrompt?: string,
  imageAttachments?: ImageAttachment[],
  webSources?: WebSource[],
  toolContext?: ToolContext
): AsyncGenerator<StreamEvent, void, unknown> {
  const buLabel  = await getBusinessUnitLabel(businessUnit);
  const policyContext = customSystemPrompt ? "" : buildPolicyContext(policies);
  const system   = buildSystem(businessUnit, buLabel, Boolean(policyContext), customSystemPrompt);
  const messages = buildClaudeMessages(conversationHistory, userMessage, imageAttachments, policyContext);

  const catalog = toolContext ? await resolveToolCatalog(toolContext) : [];
  const connectorTools = toAnthropicTools(catalog);

  let hasYielded = false;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    // On the final permitted iteration the connector tools are withheld, which is
    // what actually forces an answer out of the model. Hosted web search stays — it
    // costs no round trip of ours and Anthropic bounds it with max_uses.
    const isFinalIteration = iteration === MAX_TOOL_ITERATIONS - 1;
    const tools: Anthropic.Messages.ToolUnion[] = [
      ...webSearchTools(),
      ...(isFinalIteration ? [] : connectorTools),
    ];

    const turn = streamOneTurn(system, messages, tools, businessUnit, webSources, hasYielded);

    // Forwarded by hand rather than with `yield*` because the loop has to both pass
    // the events through and keep the generator's return value.
    let message: Anthropic.Message | null = null;
    while (true) {
      const next = await turn.next();
      if (next.done) { message = next.value; break; }
      if (next.value.type === "text") hasYielded = true;
      yield next.value;
    }

    if (!message) return;

    // Hosted tool hit its own iteration limit. Hand the assistant turn back so it
    // can continue from where it stopped.
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }

    const calls = parseAnthropicToolCalls(message.content);
    if (calls.length === 0) return;

    logger.info("[Claude/Stream] Tool round", {
      iteration,
      calls: calls.map((c) => c.name),
    });

    messages.push({ role: "assistant", content: message.content });

    const results: CompletedToolCall[] = [];
    yield* runToolCalls(calls, catalog, toolContext!, results);

    messages.push(anthropicToolResultMessage(results));
  }
}

// ─── generateJsonContent (for document generation) ───────────────────────────

export async function generateJsonContent(system: string, userPrompt: string): Promise<string> {
  const response = await claude.messages.create({
    model: MODEL,
    system: system + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no extra text, no explanation.",
    messages: [{ role: "user", content: userPrompt }],
    // Documents run long; 4000 truncated them mid-JSON and the parse failed.
    max_tokens: 8000,
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return stripJsonFences(raw);
}
