import Anthropic from "@anthropic-ai/sdk";
import { getBusinessUnitLabel } from "../config/businessUnits";
import { buildSystemPrompt } from "./openaiService";
import { PolicyContext, ImageAttachment, WebSource } from "./openaiService";
import logger from "../utils/logger";

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
  if (err instanceof Anthropic.APIError) {
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

// Strip accidental ```json``` fences Claude may add despite being told not to
function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

// ─── Message Builder ──────────────────────────────────────────────────────────

function buildClaudeMessages(
  history: Message[],
  userMessage: string,
  imageAttachments?: ImageAttachment[]
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

  let userContent: string | Anthropic.ContentBlockParam[];
  if (imageAttachments && imageAttachments.length > 0) {
    userContent = [
      { type: "text", text: userMessage || "What is in this image?" },
      ...imageAttachments.map((img): Anthropic.ImageBlockParam => ({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: img.base64,
        },
      })),
    ];
  } else {
    userContent = userMessage;
  }

  return [...historyMessages, { role: "user", content: userContent }];
}

function buildSystem(
  businessUnit: string,
  buLabel: string | null,
  policies: PolicyContext[],
  customSystemPrompt?: string
): string {
  if (customSystemPrompt) return customSystemPrompt;

  const name = buLabel || businessUnit || "your organization";
  const topPolicies = policies.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);

  if (topPolicies.length === 0) {
    return buildSystemPrompt(name, "", false, "claude");
  }

  let policyContext = "\n### Relevant Policies:\n";
  topPolicies.forEach((p, i) => {
    policyContext += `\n**${i + 1}. ${p.title}** *(${p.category})*\n${p.content}\n`;
  });
  return buildSystemPrompt(name, policyContext, true, "claude");
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
  const system  = buildSystem(businessUnit, buLabel, policies, customSystemPrompt);
  const messages = buildClaudeMessages(conversationHistory, userMessage);
  const tools    = webSearchTools();

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

  try {
    logger.info("[Claude/NonStream] Request", { model: MODEL, system: system.length, webSearch: tools.length > 0 });

    const response = await claude.messages.create(
      { model: MODEL, system, messages, max_tokens: 8192, ...(tools.length ? { tools } : {}) },
      { signal: controller.signal }
    );

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

export async function* streamAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "",
  customSystemPrompt?: string,
  imageAttachments?: ImageAttachment[],
  webSources?: WebSource[]
): AsyncGenerator<string, void, unknown> {
  const buLabel  = await getBusinessUnitLabel(businessUnit);
  const system   = buildSystem(businessUnit, buLabel, policies, customSystemPrompt);
  const messages = buildClaudeMessages(conversationHistory, userMessage, imageAttachments);
  const tools    = webSearchTools();

  let hasYielded = false;
  let lastError: unknown = null;
  const totalStart = Date.now();

  for (let attempt = 0; attempt < STREAM_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn("[Claude/Stream] Retrying after error", {
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
      logger.info("[Claude/Stream] Request", { model: MODEL, attempt });

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
          yield event.delta.text;
          hasYielded = true;
        }
      }

      // Sweep web_search_tool_result blocks from the assembled message for source pills.
      if (webSources) {
        try {
          const finalMessage = await stream.finalMessage();
          collectSourcesFromContent(finalMessage.content, webSources);
        } catch (finalErr) {
          logger.warn("[Claude/Stream] finalMessage() unavailable after stream", {
            error: finalErr instanceof Error ? finalErr.message : String(finalErr),
          });
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
      `Failed to generate Claude response: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }
}

// ─── generateJsonContent (for document generation) ───────────────────────────

export async function generateJsonContent(system: string, userPrompt: string): Promise<string> {
  const response = await claude.messages.create({
    model: MODEL,
    system: system + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown fences, no extra text, no explanation.",
    messages: [{ role: "user", content: userPrompt }],
    max_tokens: 4000,
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return stripJsonFences(raw);
}
