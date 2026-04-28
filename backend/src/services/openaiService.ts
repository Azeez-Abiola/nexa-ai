import OpenAI from "openai";
import { encodingForModel } from "js-tiktoken";
import { getBusinessUnitLabel } from "../config/businessUnits";
import { isSimpleQuery } from "../utils/queryClassifier";
import logger from "../utils/logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL                = process.env.OPEN_AI_MODEL || "gpt-5";
const tokenEncoder         = encodingForModel("gpt-4o"); // gpt-5 uses the same o200k_base tokenizer

const SOFT_CONTEXT_CEILING = 200_000;
const HISTORY_TOKEN_BUDGET = 4_000;
const RESPONSE_BUFFER      = 500;
const IMAGE_TOKEN_ESTIMATE = 500;

const STREAM_TIMEOUT_MS    = 90_000;
const STREAM_MAX_ATTEMPTS  = 3;
const RETRY_BASE_DELAY_MS  = 1_000; // delays: 1 s, 2 s for attempts 2 and 3

// gpt-5 uses extended reasoning tokens before producing output — 1500 is exhausted
// before any text delta events fire, causing response.incomplete. Use a much higher cap.
// The SOFT_CONTEXT_CEILING is the real upper bound; this just prevents over-allocating.
const MAX_RESPONSE_TOKENS_OVERRIDE = 16_384;

// ─── Light-mode constants ─────────────────────────────────────────────────────
// Used when isSimpleQuery() is true: minimal instruction payload + strict output
// cap keeps TTFT under 1 s for greetings and conversational filler.
const LIGHT_PROMPT           = "You are a friendly assistant. Respond naturally and briefly.";
const LIGHT_MAX_OUTPUT_TOKENS = 1_000;

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Token Utilities ──────────────────────────────────────────────────────────

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

// ─── Response Extraction ──────────────────────────────────────────────────────

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

// ─── Error Classification Utilities ──────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    // 5xx server errors (including the case where status is undefined but type is server_error),
    // and 429 rate-limit responses are safe to retry.
    return status >= 500 || status === 429 || err.type === "server_error";
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("socket hang up");
  }
  return false;
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

// ─── Prompt Utilities ─────────────────────────────────────────────────────────

function buildSystemPrompt(correctBUName: string, policyContext: string, hasPolicies: boolean): string {
  const basePrompt      = `You are ${correctBUName}'s Policy Assistant.`;
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

// ─── Adaptive request builder ─────────────────────────────────────────────────

interface RequestParams {
  instructions:     string;
  input:            InputMessage[];
  maxOutputTokens:  number;
  lightMode:        boolean;
  /** Approximate prompt tokens — 0 in light mode (not worth computing). */
  estimatedTokens:  number;
  imageCount:       number;
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

  // Light mode: no images + trivial text content
  if (isSimpleQuery(userMessage) && imageCount === 0) {
    return {
      instructions:    LIGHT_PROMPT,
      input,
      maxOutputTokens: LIGHT_MAX_OUTPUT_TOKENS,
      lightMode:       true,
      estimatedTokens: 0,
      imageCount:      0,
    };
  }

  // Full mode: build the complete instruction payload
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
  };
}

// ─── Input Builder ────────────────────────────────────────────────────────────

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

  // Current user turn — optionally multimodal.
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

// ─── generateAIResponse ───────────────────────────────────────────────────────

export async function generateAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "",
  customSystemPrompt?: string
): Promise<string> {
  try {
    const buLabel = await getBusinessUnitLabel(businessUnit);
    const { instructions, input, maxOutputTokens, lightMode, estimatedTokens } = buildRequestParams(
      userMessage, policies, conversationHistory, buLabel, customSystemPrompt
    );

    logger.info("[OpenAI/NonStream] Request", {
      model: MODEL, lightMode, instructionChars: instructions.length,
      maxOutputTokens, estimatedTokens,
    });

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 90_000);

    try {
      const response = await openai.responses.create({
        model:             MODEL,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
      }, { signal: controller.signal });

      return formatResponse(extractOutputText(response));
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (isAbortError(error)) throw new Error("Request timeout - please try again");
    throw new Error("Failed to generate AI response");
  }
}

// ─── streamAIResponse ────────────────────────────────────────────────────────

export async function* streamAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "",
  customSystemPrompt?: string,
  imageAttachments?: ImageAttachment[]
): AsyncGenerator<string, void, unknown> {
  const buLabel = await getBusinessUnitLabel(businessUnit);
  const {
    instructions, input, maxOutputTokens, lightMode, estimatedTokens, imageCount,
  } = buildRequestParams(
    userMessage, policies, conversationHistory, buLabel, customSystemPrompt, imageAttachments
  );

  // Log request payload summary before sending (no PII — sizes only).
  logger.info("[OpenAI/Stream] Request payload", {
    model:            MODEL,
    lightMode,
    instructionChars: instructions.length,
    inputMessages:    input.length,
    imageCount,
    maxOutputTokens,
    estimatedTokens,
  });

  // The Responses API uses `instructions` + `input` — no legacy `messages` field.
  const requestParams = {
    model:             MODEL,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
  } as const;

  let hasYielded   = false;
  let doneFallback = "";
  let lastError:   unknown = null;
  const totalStart = Date.now();

  // ── Retry loop (stream attempts) ─────────────────────────────────────────────
  for (let attempt = 0; attempt < STREAM_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1); // 1 s, 2 s
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

      const stream        = openai.responses.stream(requestParams, { signal: controller.signal });
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
          if (delta) { yield delta; hasYielded = true; }
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
      // and what the iterator exposes (e.g. text only in response.completed).
      if (!hasYielded && !doneFallback.trim()) {
        try {
          const finalResp = await stream.finalResponse();
          const text = extractOutputText(finalResp as unknown as OpenAI.Responses.Response);
          if (text && !text.includes("couldn't generate")) {
            doneFallback = text;
            logger.info("[OpenAI/Stream] Recovered text via finalResponse()", {
              attempt: attempt + 1,
              chars:   text.length,
            });
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

      lastError = null; // success
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
      if (hasYielded) {
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

  // ── gpt-5 "done" event path: text delivered only via the done event ───────────
  if (!hasYielded && doneFallback.trim() && !lastError) {
    yield doneFallback.trim();
    return;
  }

  // ── Non-streaming fallback after all stream attempts exhausted ───────────────
  if (!hasYielded && lastError) {
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

      yield text;
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
}

// ─── generateConversationTitle ────────────────────────────────────────────────

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
