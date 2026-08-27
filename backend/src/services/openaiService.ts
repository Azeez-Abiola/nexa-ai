import OpenAI from "openai";
import { encodingForModel } from "js-tiktoken";
import { getBusinessUnitLabel } from "../config/businessUnits";
import { labelForModelId } from "../config/modelLabels";
import { isSimpleQuery } from "../utils/queryClassifier";
import logger from "../utils/logger";
import { recordUsage } from "./usageService";
import { classifyProviderError, isRetryableFailure, retryDelayMs } from "./providerHealth";
import { toResponsesTools, parseResponsesToolCalls, responsesToolResult } from "./tools/adapters/openaiShape";
import { CompletedToolCall, runToolCalls } from "./tools/loop";
import { resolveToolCatalog } from "./tools/router";
import { CanonicalTool, MAX_TOOL_ITERATIONS, StreamEvent, ToolContext } from "./tools/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const MODEL                = process.env.OPEN_AI_MODEL || "gpt-5";
const tokenEncoder         = encodingForModel("gpt-4o"); // gpt-5 uses the same o200k_base tokenizer

const WEB_SEARCH_ENABLED = process.env.WEB_SEARCH_ENABLED !== "false";
const WEB_SEARCH_FORCE   = process.env.WEB_SEARCH_FORCE === "true";

const REASONING_EFFORT =
  (process.env.OPENAI_REASONING_EFFORT as OpenAI.Reasoning["effort"]) || "low";

/** Sink for web citations surfaced during a response, used to build source pills. */
export interface WebSource {
  title: string;
  link: string;
}

const WEB_SEARCH_TOOL = { type: "web_search" as const };

/** Push a deduped web citation into the collector (by url). */
function collectWebSource(
  collector: WebSource[] | undefined,
  url: unknown,
  title: unknown
): void {
  if (!collector) return;
  const link = typeof url === "string" ? url.trim() : "";
  if (!link || collector.some((s) => s.link === link)) return;
  collector.push({ link, title: (typeof title === "string" && title.trim()) || link });
}

/** Extract url_citation annotations from a fully-assembled Response into the collector. */
function collectSourcesFromResponse(
  response: OpenAI.Responses.Response | undefined,
  collector: WebSource[] | undefined
): void {
  if (!collector || !response?.output) return;
  for (const item of response.output as any[]) {
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      for (const ann of part?.annotations ?? []) {
        if (ann?.type === "url_citation") collectWebSource(collector, ann.url, ann.title);
      }
    }
  }
}

const SOFT_CONTEXT_CEILING = 200_000;
const HISTORY_TOKEN_BUDGET = 4_000;
const RESPONSE_BUFFER      = 500;
const IMAGE_TOKEN_ESTIMATE = 500;

// Web search legitimately runs longer (multiple server-side searches + page reads), so give
// the stream more headroom than the old 90s text-only ceiling. Tunable via OPENAI_STREAM_TIMEOUT_MS.
const STREAM_TIMEOUT_MS    = Number(process.env.OPENAI_STREAM_TIMEOUT_MS) || 120_000;
const STREAM_MAX_ATTEMPTS  = 3;
const RETRY_BASE_DELAY_MS  = 1_000; // delays: 1 s, 2 s for attempts 2 and 3

const MAX_RESPONSE_TOKENS_OVERRIDE = 16_384;
const LIGHT_PROMPT           = "You are Nexa AI, a friendly assistant. Respond naturally and briefly.";
const LIGHT_MAX_OUTPUT_TOKENS = 1_000;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  /** Public image URLs attached to a historical message — rehydrated into multimodal parts on replay. */
  imageUrls?: string[];
}

export interface PolicyContext {
  title: string;
  category: string;
  content: string;
  score?: number;
}

export interface ImageAttachment {
  base64: string;
  mimeType: string;
}

type InputMessage      = OpenAI.Responses.EasyInputMessage;
type InputContentPart  = OpenAI.Responses.ResponseInputContent;

function estimateTokens(text: string): number {
  try {
    return tokenEncoder.encode(text).length;
  } catch {
    return Math.ceil(text.length / 4);
  }
}

function trimConversationHistory(history: Message[]): Message[] {
  let used = 0;
  const kept: Message[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const textTokens  = estimateTokens(history[i].content);
    const imageTokens = (history[i].imageUrls?.length ?? 0) * IMAGE_TOKEN_ESTIMATE;
    if (used + textTokens + imageTokens > HISTORY_TOKEN_BUDGET) break;
    kept.unshift(history[i]);
    used += textTokens + imageTokens;
  }
  return kept;
}

function computeMaxTokens(usedTokens: number): number {
  const available = SOFT_CONTEXT_CEILING - usedTokens - RESPONSE_BUFFER;
  return Math.min(MAX_RESPONSE_TOKENS_OVERRIDE, Math.max(available, 200));
}

function extractOutputText(response: OpenAI.Responses.Response): string {
  return (
    response.output_text ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (response.output?.[0] as any)?.content?.[0]?.text ||
    "I apologize, but I couldn't generate a response. Please try again."
  );
}

function formatResponse(text: string): string {
  return text.trim();
}

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
  return (
    (err instanceof Error && (err.message.includes("aborted") || err.name === "AbortError"))
  );
}

function extractErrorMeta(err: unknown): Record<string, unknown> {
  if (err instanceof OpenAI.APIError) {
    return {
      status:    err.status,
      type:      err.type,
      code:      err.code,
      requestId: err.requestID,
      message:   err.message,
    };
  }
  return { message: err instanceof Error ? err.message : String(err) };
}

/**
 * @param activeModelId The provider's resolved (env-configured) model id — e.g. the
 *   `MODEL` constant each service exports. Passing the real id rather than a provider
 *   name keeps the self-reported label from drifting when CLAUDE_MODEL et al. change.
 */
export function buildSystemPrompt(correctBUName: string, policyContext: string, hasPolicies: boolean, activeModelId: string = MODEL): string {
  const modelLabel = labelForModelId(activeModelId);
  const basePrompt = `You are Nexa AI, ${correctBUName}'s Policy Assistant, powered by ${modelLabel}. If asked which model or AI you use, say you are Nexa AI powered by ${modelLabel}.`;
  const formattingGuide = `Format responses with: **bold** for key terms, *italics* for emphasis, ### headers, numbered/bullet lists, --- separators, and code blocks for examples.`;

  if (hasPolicies) {
    return `${basePrompt}\n\n${formattingGuide}\n\n${policyContext}\n\nRules: ONLY reference above documents. Cite document sections and links. If not found, say "Not in our documents. Contact HR & Compliance." Include relevant links in responses. Be professional and concise.`;
  }
  return `${basePrompt}\n\n${formattingGuide}\n\nRules: Only provide ${correctBUName} information. Ignore other BUs. When unsure, direct to HR & Compliance. Recommend HR verification. Be professional and concise.`;
}

function buildPolicyContext(policies: PolicyContext[]): { policyContext: string; hasPolicies: boolean } {
  const topPolicies = policies
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3);

  if (topPolicies.length === 0) return { policyContext: "", hasPolicies: false };

  let policyContext = "\n### Relevant Policies:\n";
  topPolicies.forEach((policy, idx) => {
    policyContext += `\n**${idx + 1}. ${policy.title}** *(${policy.category})*\n${policy.content}\n`;
  });
  return { policyContext, hasPolicies: true };
}

interface RequestParams {
  instructions:     string;
  input:            InputMessage[];
  maxOutputTokens:  number;
  lightMode:        boolean;
  /** Approximate prompt tokens — 0 in light mode (not worth computing). */
  estimatedTokens:  number;
  imageCount:       number;
  /** Hosted web-search tool, enabled for full-mode requests only. */
  tools?:           OpenAI.Responses.Tool[];
  toolChoice?:      OpenAI.Responses.ToolChoiceOptions;
}

/** Web-search tool + choice for a request, or empty when disabled/light mode. */
function webSearchConfig(lightMode: boolean): Pick<RequestParams, "tools" | "toolChoice"> {
  if (lightMode || !WEB_SEARCH_ENABLED) return {};
  return {
    tools: [WEB_SEARCH_TOOL],
    ...(WEB_SEARCH_FORCE ? { toolChoice: "required" as const } : {}),
  };
}

/**
 * Builds the Responses-API request parameters, branching on query complexity.
 *
 * Light mode (isSimpleQuery = true, no images):
 *   - Instructions: a single short sentence (17 chars vs ~5 000 for the full prompt)
 *   - max_output_tokens: 100  → model stops almost immediately
 *   - Policy context and token-counting are skipped entirely
 *
 * Full mode:
 *   - Uses the caller-supplied customSystemPrompt or falls back to buildSystemPrompt()
 *   - Token budget is computed from actual payload sizes
 */
function buildRequestParams(
  userMessage:       string,
  policies:          PolicyContext[],
  conversationHistory: Message[],
  buLabel:           string,
  customSystemPrompt?: string,
  imageAttachments?: ImageAttachment[]
): RequestParams {
  const trimmedHistory = trimConversationHistory(conversationHistory);
  const input          = buildInputMessages(trimmedHistory, userMessage, imageAttachments);
  const imageCount     =
    (imageAttachments?.length ?? 0) +
    trimmedHistory.reduce((sum, m) => sum + (m.imageUrls?.length ?? 0), 0);

  if (isSimpleQuery(userMessage) && imageCount === 0) {
    return {
      instructions:    LIGHT_PROMPT,
      input,
      maxOutputTokens: LIGHT_MAX_OUTPUT_TOKENS,
      lightMode:       true,
      estimatedTokens: 0,
      imageCount:      0,
      ...webSearchConfig(true),
    };
  }

  const correctBUName = buLabel || "your organization";
  const { policyContext, hasPolicies } = buildPolicyContext(policies);
  const instructions  = customSystemPrompt ?? buildSystemPrompt(correctBUName, policyContext, hasPolicies);

  const estimatedTokens =
    estimateTokens(instructions) +
    estimateTokens(userMessage) +
    estimateTokens(trimmedHistory.map((m) => m.content).join(" ")) +
    imageCount * IMAGE_TOKEN_ESTIMATE;

  return {
    instructions,
    input,
    maxOutputTokens: computeMaxTokens(estimatedTokens),
    lightMode:       false,
    estimatedTokens,
    imageCount,
    ...webSearchConfig(false),
  };
}

function buildInputMessages(
  trimmedHistory: Message[],
  userMessage: string,
  imageAttachments?: ImageAttachment[]
): InputMessage[] {
  // System messages are passed via `instructions` — filter them to avoid duplication.
  const historyMessages: InputMessage[] = trimmedHistory
    .filter((msg) => msg.role !== "system")
    .map((msg) => {
      if (msg.role === "user" && msg.imageUrls && msg.imageUrls.length > 0) {
        const parts: InputContentPart[] = [
          { type: "input_text", text: msg.content || "" },
          ...msg.imageUrls.map((url): OpenAI.Responses.ResponseInputImage => ({
            type: "input_image", image_url: url, detail: "auto",
          })),
        ];
        return { role: "user" as const, content: parts };
      }
      return { role: msg.role as "user" | "assistant", content: msg.content };
    });

  let userContent: string | InputContentPart[];
  if (imageAttachments && imageAttachments.length > 0) {
    userContent = [
      { type: "input_text", text: userMessage || "What is in this image?" },
      ...imageAttachments.map((img): OpenAI.Responses.ResponseInputImage => ({
        type: "input_image",
        image_url: `data:${img.mimeType};base64,${img.base64}`,
        detail: "auto",
      })),
    ];
  } else {
    userContent = userMessage;
  }

  return [...historyMessages, { role: "user", content: userContent }];
}

export async function generateAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "",
  customSystemPrompt?: string,
  webSources?: WebSource[]
): Promise<string> {
  try {
    const buLabel = await getBusinessUnitLabel(businessUnit);
    const { instructions, input, maxOutputTokens, lightMode, estimatedTokens, tools, toolChoice } = buildRequestParams(
      userMessage, policies, conversationHistory, buLabel, customSystemPrompt
    );

    logger.info("[OpenAI/NonStream] Request", {
      model: MODEL, lightMode, instructionChars: instructions.length,
      maxOutputTokens, estimatedTokens, webSearch: Boolean(tools?.length),
    });

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 90_000);

    try {
      const response = await openai.responses.create({
        model:             MODEL,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
        reasoning:         { effort: REASONING_EFFORT },
        ...(tools ? { tools } : {}),
        ...(toolChoice ? { tool_choice: toolChoice } : {}),
      }, { signal: controller.signal });

      collectSourcesFromResponse(response, webSources);
      recordUsage({ businessUnit, provider: "gpt", modelId: MODEL, usage: response.usage, mode: "generate" });
      return formatResponse(extractOutputText(response));
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (isAbortError(error)) throw new Error("Request timeout - please try again");
    throw new Error("Failed to generate AI response");
  }
}

/**
 * Stream a response, executing connector tools as the model asks for them.
 *
 * GPT reaches connectors the same way the other three providers do — Nexa executes
 * the tool and feeds the result back. The Responses API's own MCP tool type is
 * deliberately not used: it has OpenAI's servers connect to the MCP server directly,
 * which would route the call around the Tool Router, the RBAC check, and the audit
 * log. For a holding company that needs to answer who did what, in which system, the
 * shortcut costs exactly the things the gateway exists to provide.
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
  const buLabel = await getBusinessUnitLabel(businessUnit);
  const params  = buildRequestParams(
    userMessage, policies, conversationHistory, buLabel, customSystemPrompt, imageAttachments
  );

  /**
   * Light mode gets no connectors, for the same reason it gets no web search: a
   * greeting does not need the knowledge base, and the tool catalog is charged as
   * input tokens on every turn that carries it. Scoping the catalog to turns that
   * could plausibly use it is the difference between connectors being affordable
   * across four providers and not.
   */
  const catalog: CanonicalTool[] =
    toolContext && !params.lightMode ? await resolveToolCatalog(toolContext) : [];
  const connectorTools = toResponsesTools(catalog);

  logger.info("[OpenAI/Stream] Request payload", {
    model:            MODEL,
    lightMode:        params.lightMode,
    instructionChars: params.instructions.length,
    inputMessages:    params.input.length,
    imageCount:       params.imageCount,
    maxOutputTokens:  params.maxOutputTokens,
    estimatedTokens:  params.estimatedTokens,
    webSearch:        Boolean(params.tools?.length),
    connectorTools:   connectorTools.length,
  });

  // Grows within the turn as tool calls and their results are appended.
  const input: OpenAI.Responses.ResponseInputItem[] = [
    ...(params.input as OpenAI.Responses.ResponseInputItem[]),
  ];
  let hasYielded = false;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    // Withholding the tools on the last permitted iteration is what forces an
    // answer. Hosted web search stays — OpenAI bounds that one itself.
    const isFinalIteration = iteration === MAX_TOOL_ITERATIONS - 1;
    const tools: OpenAI.Responses.Tool[] = [
      ...(params.tools ?? []),
      ...(isFinalIteration ? [] : connectorTools),
    ];

    // No `stream` field: this same object is handed to both `responses.stream()` and
    // the non-streaming `responses.create()` fallback inside the helper.
    const requestParams: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
      model:             MODEL,
      instructions:      params.instructions,
      input,
      max_output_tokens: params.maxOutputTokens,
      reasoning:         { effort: REASONING_EFFORT },
      ...(tools.length ? { tools } : {}),
      ...(params.toolChoice ? { tool_choice: params.toolChoice } : {}),
    };

    const turn = streamSingleTurn(requestParams, businessUnit, webSources, hasYielded);

    // Forwarded by hand rather than with `yield*`, because the loop needs both the
    // events and the generator's return value.
    let output: unknown[] = [];
    while (true) {
      const next = await turn.next();
      if (next.done) { output = next.value ?? []; break; }
      if (next.value.type === "text") hasYielded = true;
      yield next.value;
    }

    const calls = parseResponsesToolCalls(output);
    if (calls.length === 0) return;

    logger.info("[OpenAI/Stream] Tool round", {
      iteration,
      calls: calls.map((c) => c.name),
    });

    /**
     * Every output item is echoed back, not just the function calls. The Responses
     * API is stateless when driven this way, and gpt-5 emits reasoning items
     * alongside its function calls that it expects to see again on the next request
     * — dropping them loses the model's own working state mid-turn.
     */
    input.push(...(output as OpenAI.Responses.ResponseInputItem[]));

    const results: CompletedToolCall[] = [];
    yield* runToolCalls(calls, catalog, toolContext!, results);

    for (const result of results) {
      input.push(responsesToolResult(result.callId, result.content));
    }
  }
}

/**
 * One model call, streamed.
 *
 * This is the whole of the previous streamAIResponse, unchanged in substance: the
 * three retry attempts, the several gpt-5 text-recovery paths, and the
 * non-streaming fallback all still live here. It became a helper so the tool loop
 * above it can call it repeatedly, and retries stay scoped to a single call —
 * replaying a loop iteration would re-execute every tool in it.
 *
 * Returns the completed response's output items, which is where the model's
 * function calls are found.
 */
async function* streamSingleTurn(
  requestParams: OpenAI.Responses.ResponseCreateParamsNonStreaming,
  businessUnit: string,
  webSources: WebSource[] | undefined,
  hasYieldedGlobally: boolean
): AsyncGenerator<StreamEvent, unknown[], unknown> {
  /** Output items from the completed response — the source of function calls. */
  let outputItems: unknown[] = [];

  // The request payload is logged by the caller, which knows the real light-mode,
  // token-estimate and image counts. Logging it again from here would have meant
  // inventing those values.
  logger.info("[OpenAI/Stream] Turn", {
    model:         MODEL,
    inputItems:    (requestParams.input as unknown[]).length,
    tools:         requestParams.tools?.length ?? 0,
  });

  let hasYielded   = false;
  let doneFallback = "";
  let lastError:   unknown = null;
  const totalStart = Date.now();

  for (let attempt = 0; attempt < STREAM_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = retryDelayMs(lastError, attempt, RETRY_BASE_DELAY_MS);
      logger.warn("[OpenAI/Stream] Retrying stream after error", {
        attempt,
        delayMs,
        totalElapsedMs: Date.now() - totalStart,
        ...extractErrorMeta(lastError),
      });
      await sleep(delayMs);
    }

    const controller   = new AbortController();
    const timeoutId    = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
    const attemptStart = Date.now();

    try {
      logger.info("[OpenAI/Stream] Starting stream attempt", {
        attempt:     attempt + 1,
        maxAttempts: STREAM_MAX_ATTEMPTS,
      });

      // Cast because the two entry points disagree about `stream` in their types —
      // `.stream()` wants it absent-or-true, `.create()` (used by the fallback below)
      // wants it absent-or-false. One object has to serve both, and omitting the
      // field entirely is what both actually accept at runtime.
      const stream        = openai.responses.stream(
        requestParams as unknown as Parameters<typeof openai.responses.stream>[0],
        { signal: controller.signal }
      );
      let firstChunk      = true;
      const seenEventTypes: string[] = [];

      for await (const event of stream) {
        if (firstChunk) {
          logger.info("[OpenAI/Stream] First event received", {
            attempt:        attempt + 1,
            ttftMs:         Date.now() - attemptStart,
            firstEventType: event.type,
          });
          firstChunk = false;
        }

        // Collect unique event types for observability (capped at 20 entries).
        if (seenEventTypes.length < 20 && !seenEventTypes.includes(event.type)) {
          seenEventTypes.push(event.type);
        }

        if (event.type === "response.output_text.delta") {
          const delta = (event as any).delta ?? "";
          if (delta) { yield { type: "text", text: delta }; hasYielded = true; }
        } else if (event.type === "response.output_text.annotation.added") {
          // Web search citations arrive as url_citation annotations — collect for source pills.
          const ann = (event as any).annotation;
          if (ann?.type === "url_citation") collectWebSource(webSources, ann.url, ann.title);
        } else if (event.type === "response.output_text.done") {
          // gpt-5 may deliver the full text only via the done event (no per-character deltas).
          const text = (event as any).text ?? "";
          if (text) doneFallback = text;
        } else if (event.type === "response.output_item.done") {
          // gpt-5 may buffer all text inside the completed output item rather than
          // emitting per-character delta events — extract it here as a fallback.
          if (!doneFallback) {
            const item = (event as any).item;
            if (item?.type === "message" && Array.isArray(item.content)) {
              const text = item.content
                .filter((p: any) => p.type === "output_text" || p.type === "text")
                .map((p: any) => p.text ?? "")
                .join("");
              if (text) doneFallback = text;
            }
          }
        } else if (event.type === "response.completed") {
          // gpt-5 may deliver text exclusively in the top-level completed event.
          if (!doneFallback) {
            const completedText = extractOutputText((event as any).response ?? {});
            if (completedText && !completedText.includes("couldn't generate")) {
              doneFallback = completedText;
            }
          }
        } else if (event.type === "response.incomplete") {
          // Model hit max_output_tokens before finishing — log so it's visible.
          logger.warn("[OpenAI/Stream] Response incomplete (hit token limit)", {
            attempt: attempt + 1,
            elapsedMs: Date.now() - attemptStart,
          });
        }
      }

      // Ultimate fallback: after the stream closes normally, ask the SDK for the
      // fully-assembled Response object. Covers any event-type gap between gpt-5
      // and what the iterator exposes (e.g. text only in response.completed), and
      // sweeps url_citation annotations in case they weren't emitted as stream events.
      // Now unconditional: the completed response is the only place the model's
      // function calls appear, so a turn that skipped this would silently drop every
      // tool call the model made.
      {
        try {
          const finalResp = await stream.finalResponse();
          outputItems = (finalResp as unknown as OpenAI.Responses.Response).output ?? [];
          collectSourcesFromResponse(finalResp as unknown as OpenAI.Responses.Response, webSources);
          recordUsage({
            businessUnit,
            provider: "gpt",
            modelId: MODEL,
            usage: (finalResp as unknown as OpenAI.Responses.Response).usage,
            mode: "stream",
          });
          if (!hasYielded && !doneFallback.trim()) {
            const text = extractOutputText(finalResp as unknown as OpenAI.Responses.Response);
            if (text && !text.includes("couldn't generate")) {
              doneFallback = text;
              logger.info("[OpenAI/Stream] Recovered text via finalResponse()", {
                attempt: attempt + 1,
                chars:   text.length,
              });
            }
          }
        } catch (finalErr) {
          logger.warn("[OpenAI/Stream] finalResponse() unavailable after stream", {
            ...extractErrorMeta(finalErr),
          });
        }
      }

      logger.info("[OpenAI/Stream] Stream completed", {
        attempt:           attempt + 1,
        streamMs:          Date.now() - attemptStart,
        totalMs:           Date.now() - totalStart,
        hasYielded,
        doneFallbackChars: doneFallback.length,
        seenEventTypes,
      });

      lastError = null;
      break;

    } catch (err) {
      logger.error("[OpenAI/Stream] Stream attempt failed", {
        attempt:   attempt + 1,
        elapsedMs: Date.now() - attemptStart,
        ...extractErrorMeta(err),
      });

      // Our own AbortController fired — this is a hard timeout, not a transient error.
      if (isAbortError(err)) {
        clearTimeout(timeoutId);
        throw new Error("Request timeout - please try again");
      }

      // If we already yielded some chunks, the client has partial data — retrying
      // would send a duplicate response, so just surface the error.
      if (hasYielded || hasYieldedGlobally) {
        clearTimeout(timeoutId);
        throw new Error(
          `Stream interrupted: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      lastError = err;

      if (!isRetryableError(err)) {
        // Non-retryable error (e.g. 400 bad request, 401 auth) — skip remaining retries.
        logger.warn("[OpenAI/Stream] Non-retryable error, skipping remaining attempts", {
          ...extractErrorMeta(err),
        });
        break;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // gpt-5 may deliver text only via the "done" event path, with no per-character deltas.
  if (!hasYielded && doneFallback.trim() && !lastError) {
    yield { type: "text", text: doneFallback.trim() };
    return outputItems;
  }

  if (!hasYielded && lastError) {
    // The non-streaming fallback exists for transport-level stream failures. It cannot
    // help when the account itself can't serve — an exhausted quota or a bad key fails
    // identically on both transports, so retrying here just burns ~5s before the router
    // fails over to another provider. Surface it immediately instead.
    const { kind } = classifyProviderError(lastError);
    if (kind === "quota" || kind === "auth") {
      logger.warn("[OpenAI/Stream] Skipping non-streaming fallback — account cannot serve", {
        kind,
        totalElapsedMs: Date.now() - totalStart,
        ...extractErrorMeta(lastError),
      });
      throw new Error(
        `Failed to generate AI response: ${
          lastError instanceof Error ? lastError.message : String(lastError)
        }`
      );
    }

    logger.warn("[OpenAI/Stream] All stream attempts failed — falling back to non-streaming", {
      totalElapsedMs: Date.now() - totalStart,
      ...extractErrorMeta(lastError),
    });

    const fallbackStart = Date.now();
    const controller    = new AbortController();
    const timeoutId     = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      const response = await openai.responses.create(
        { ...requestParams },
        { signal: controller.signal }
      );
      const text = formatResponse(extractOutputText(response));

      logger.info("[OpenAI/Stream] Non-streaming fallback succeeded", {
        fallbackMs: Date.now() - fallbackStart,
        totalMs:    Date.now() - totalStart,
        chars:      text.length,
      });

      yield { type: "text", text };
    } catch (fallbackErr) {
      logger.error("[OpenAI/Stream] Non-streaming fallback also failed", {
        fallbackMs: Date.now() - fallbackStart,
        totalMs:    Date.now() - totalStart,
        ...extractErrorMeta(fallbackErr),
      });

      if (isAbortError(fallbackErr)) throw new Error("Request timeout - please try again");
      throw new Error(
        `Failed to generate AI response: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return outputItems;
}

export async function generateConversationTitle(userMessage: string): Promise<string> {
  const fallback = () => {
    const s = userMessage.substring(0, 40);
    return s.length === 40 ? s + "..." : s;
  };

  try {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await openai.responses.create({
        model:             MODEL,
        instructions:      "Create a brief title (5-10 words, professional). Return ONLY the title text.",
        input:             [{ role: "user", content: `Title for: "${userMessage.substring(0, 100)}"` }],
        max_output_tokens: 30,
      }, { signal: controller.signal });

      const title = (response.output_text || "").trim();
      return title || fallback();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return fallback();
  }
}
