import OpenAI from "openai";
import { encodingForModel } from "js-tiktoken";
import { getBusinessUnitLabel } from "../config/businessUnits";
import { buildSystemPrompt } from "./openaiService";
import { PolicyContext, ImageAttachment } from "./openaiService";
import { isSimpleQuery } from "../utils/queryClassifier";
import logger from "../utils/logger";

if (!process.env.DEEPSEEK_API_KEY) {
  logger.warn("[DeepSeekService] DEEPSEEK_API_KEY not set — DeepSeek requests will fail at runtime");
}

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";

const STREAM_MAX_ATTEMPTS  = 3;
const RETRY_BASE_DELAY_MS  = 1_000;
const STREAM_TIMEOUT_MS    = 90_000;
const HISTORY_TOKEN_BUDGET = 4_000;
const IMAGE_TOKEN_ESTIMATE = 500;
const LIGHT_MAX_OUTPUT_TOKENS = 1_000;

const LIGHT_PROMPT = "You are Nexa AI, a friendly assistant powered by DeepSeek v4. Respond naturally and briefly. If asked which model or AI you use, say you are Nexa AI powered by DeepSeek v4.";

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
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    return status >= 500 || status === 429;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("socket hang up");
  }
  return false;
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

function buildDeepSeekMessages(
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
    return { system: buildSystemPrompt(name, "", false, "deepseek"), maxTokens: 8192 };
  }

  let policyContext = "\n### Relevant Policies:\n";
  topPolicies.forEach((p, i) => {
    policyContext += `\n**${i + 1}. ${p.title}** *(${p.category})*\n${p.content}\n`;
  });
  return { system: buildSystemPrompt(name, policyContext, true, "deepseek"), maxTokens: 8192 };
}

export async function generateAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "",
  customSystemPrompt?: string
): Promise<string> {
  const buLabel = await getBusinessUnitLabel(businessUnit);
  const history = trimHistory(conversationHistory);
  const { system, maxTokens } = buildSystem(businessUnit, buLabel, policies, userMessage, 0, customSystemPrompt);
  const messages = buildDeepSeekMessages(system, history, userMessage);

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  try {
    logger.info("[DeepSeek/NonStream] Request", { model: MODEL, system: system.length });

    const response = await deepseek.chat.completions.create(
      { model: MODEL, messages, max_tokens: maxTokens, stream: false },
      { signal: controller.signal }
    );

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
  imageAttachments?: ImageAttachment[]
): AsyncGenerator<string, void, unknown> {
  const buLabel    = await getBusinessUnitLabel(businessUnit);
  const history    = trimHistory(conversationHistory);
  const imageCount = (imageAttachments?.length ?? 0) + history.reduce((n, m) => n + (m.imageUrls?.length ?? 0), 0);
  const { system, maxTokens } = buildSystem(businessUnit, buLabel, policies, userMessage, imageCount, customSystemPrompt);
  const messages = buildDeepSeekMessages(system, history, userMessage, imageAttachments);

  let hasYielded = false;
  let lastError: unknown = null;
  const totalStart = Date.now();

  for (let attempt = 0; attempt < STREAM_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn("[DeepSeek/Stream] Retrying after error", {
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
      logger.info("[DeepSeek/Stream] Request", { model: MODEL, attempt });

      const stream = await deepseek.chat.completions.create(
        { model: MODEL, messages, max_tokens: maxTokens, stream: true },
        { signal: controller.signal }
      );

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
          hasYielded = true;
        }
      }

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
      `Failed to generate DeepSeek response: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }
}

// ─── generateJsonContent (for document generation) ───────────────────────────

export async function generateJsonContent(system: string, userPrompt: string): Promise<string> {
  const response = await deepseek.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no extra text, no explanation." },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4000,
    stream: false,
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return stripJsonFences(raw);
}
