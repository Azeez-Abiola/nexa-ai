import OpenAI from "openai";
import { encodingForModel } from "js-tiktoken";
import { getBusinessUnitLabel } from "../config/businessUnits";
import { buildSystemPrompt } from "./openaiService";
import { PolicyContext, ImageAttachment, WebSource } from "./openaiService";
import { isSimpleQuery } from "../utils/queryClassifier";
import logger from "../utils/logger";
import { recordUsage } from "./usageService";
import { isRetryableFailure, retryDelayMs } from "./providerHealth";

if (!process.env.KIMI_API_KEY) {
  logger.warn("[KimiService] KIMI_API_KEY not set — Kimi requests will fail at runtime");
}

const kimi = new OpenAI({
  apiKey: process.env.KIMI_API_KEY,
  baseURL: "https://api.moonshot.ai/v1",
});
export const MODEL = process.env.KIMI_MODEL || "kimi-k2.5";

const STREAM_MAX_ATTEMPTS  = 3;
const RETRY_BASE_DELAY_MS  = 1_000;
const STREAM_TIMEOUT_MS    = 90_000;
const HISTORY_TOKEN_BUDGET = 4_000;
const IMAGE_TOKEN_ESTIMATE = 500;
const LIGHT_MAX_OUTPUT_TOKENS = 1_000;

const LIGHT_PROMPT = "You are Nexa AI, a friendly assistant powered by Kimi k2.5. Respond naturally and briefly. If asked which model or AI you use, say you are Nexa AI powered by Kimi k2.5.";

const tokenEncoder = encodingForModel("gpt-4o");

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  imageUrls?: string[];
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
  return err instanceof Error && (err.message.includes("aborted") || err.name === "AbortError");
}

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function estimateTokens(text: string): number {
  try { return tokenEncoder.encode(text).length; } catch { return Math.ceil(text.length / 4); }
}

function trimHistory(history: Message[]): Message[] {
  let used = 0;
  const kept: Message[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(history[i].content) + (history[i].imageUrls?.length ?? 0) * IMAGE_TOKEN_ESTIMATE;
    if (used + tokens > HISTORY_TOKEN_BUDGET) break;
    kept.unshift(history[i]);
    used += tokens;
  }
  return kept;
}

function buildKimiMessages(
  systemPrompt: string,
  history: Message[],
  userMessage: string,
  imageAttachments?: ImageAttachment[]
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const m of history.filter((h) => h.role !== "system")) {
    if (m.role === "user" && m.imageUrls && m.imageUrls.length > 0) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: m.content || "" },
          ...m.imageUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      });
    } else {
      messages.push({ role: m.role as "user" | "assistant", content: m.content });
    }
  }

  if (imageAttachments && imageAttachments.length > 0) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userMessage || "What is in this image?" },
        ...imageAttachments.map((img) => ({
          type: "image_url" as const,
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        })),
      ],
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  return messages;
}

function buildSystem(
  businessUnit: string,
  buLabel: string | null,
  policies: PolicyContext[],
  userMessage: string,
  imageCount: number,
  customSystemPrompt?: string
): { system: string; maxTokens: number } {
  if (customSystemPrompt) return { system: customSystemPrompt, maxTokens: 8192 };

  if (isSimpleQuery(userMessage) && imageCount === 0) {
    return { system: LIGHT_PROMPT, maxTokens: LIGHT_MAX_OUTPUT_TOKENS };
  }

  const name = buLabel || businessUnit || "your organization";
  const topPolicies = policies.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);

  if (topPolicies.length === 0) {
    return { system: buildSystemPrompt(name, "", false, MODEL), maxTokens: 8192 };
  }

  let policyContext = "\n### Relevant Policies:\n";
  topPolicies.forEach((p, i) => {
    policyContext += `\n**${i + 1}. ${p.title}** *(${p.category})*\n${p.content}\n`;
  });
  return { system: buildSystemPrompt(name, policyContext, true, MODEL), maxTokens: 8192 };
}

// ─── generateAIResponse ───────────────────────────────────────────────────────

export async function generateAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "",
  customSystemPrompt?: string,
  // Kimi's endpoint has no hosted web-search tool; accepted for signature parity, unused.
  _webSources?: WebSource[]
): Promise<string> {
  const buLabel = await getBusinessUnitLabel(businessUnit);
  const history = trimHistory(conversationHistory);
  const { system, maxTokens } = buildSystem(businessUnit, buLabel, policies, userMessage, 0, customSystemPrompt);
  const messages = buildKimiMessages(system, history, userMessage);

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  try {
    logger.info("[Kimi/NonStream] Request", { model: MODEL, system: system.length });

    const response = await kimi.chat.completions.create(
      { model: MODEL, messages, max_tokens: maxTokens, stream: false },
      { signal: controller.signal }
    );

    recordUsage({ businessUnit, provider: "kimi", modelId: MODEL, usage: response.usage, mode: "generate" });

    const text = response.choices[0]?.message?.content ?? "";
    return text.trim() || "I couldn't generate a response. Please try again.";
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function* streamAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "",
  customSystemPrompt?: string,
  imageAttachments?: ImageAttachment[],
  // Kimi's endpoint has no hosted web-search tool; accepted for signature parity, unused.
  _webSources?: WebSource[]
): AsyncGenerator<string, void, unknown> {
  const buLabel    = await getBusinessUnitLabel(businessUnit);
  const history    = trimHistory(conversationHistory);
  const imageCount = (imageAttachments?.length ?? 0) + history.reduce((n, m) => n + (m.imageUrls?.length ?? 0), 0);
  const { system, maxTokens } = buildSystem(businessUnit, buLabel, policies, userMessage, imageCount, customSystemPrompt);
  const messages = buildKimiMessages(system, history, userMessage, imageAttachments);

  let hasYielded = false;
  let lastError: unknown = null;
  const totalStart = Date.now();

  for (let attempt = 0; attempt < STREAM_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = retryDelayMs(lastError, attempt, RETRY_BASE_DELAY_MS);
      logger.warn("[Kimi/Stream] Retrying after error", {
        attempt,
        delayMs,
        totalElapsedMs: Date.now() - totalStart,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      });
      await sleep(delayMs);
    }

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

    try {
      logger.info("[Kimi/Stream] Request", { model: MODEL, attempt });

      const stream = await kimi.chat.completions.create(
        {
          model: MODEL,
          messages,
          max_tokens: maxTokens,
          stream: true,
          // Chat Completions omits usage from stream chunks unless asked; without
          // this the final chunk carries no token counts to record.
          stream_options: { include_usage: true },
        },
        { signal: controller.signal }
      );

      let streamUsage: unknown;
      for await (const chunk of stream) {
        // The usage-bearing final chunk has an empty choices array.
        if (chunk.usage) streamUsage = chunk.usage;
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
          hasYielded = true;
        }
      }
      recordUsage({ businessUnit, provider: "kimi", modelId: MODEL, usage: streamUsage, mode: "stream" });

      lastError = null;
      break;
    } catch (err) {
      clearTimeout(timeoutId);
      if (isAbortError(err)) throw new Error("Request timeout");
      if (hasYielded) throw err;
      lastError = err;
      if (!isRetryableError(err)) break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!hasYielded && lastError) {
    throw new Error(
      `Failed to generate Kimi response: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }
}

// ─── generateJsonContent (for document generation) ───────────────────────────

export async function generateJsonContent(system: string, userPrompt: string): Promise<string> {
  const response = await kimi.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no extra text, no explanation." },
      { role: "user", content: userPrompt },
    ],
    // Documents run long; 4000 truncated them mid-JSON and the parse failed.
    max_tokens: 8000,
    stream: false,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return stripJsonFences(raw);
}
