import OpenAI from "openai";
import { encodingForModel } from "js-tiktoken";
import { getBusinessUnitConfig, formatBusinessUnit } from "../config/businessUnits";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPEN_AI_MODEL || "gpt-5";
const tokenEncoder = encodingForModel("gpt-4o"); // gpt-5 uses the same o200k_base tokenizer

const SOFT_CONTEXT_CEILING = 200_000;
const HISTORY_TOKEN_BUDGET = 4_000;
const RESPONSE_BUFFER      = 500;
const MAX_RESPONSE_TOKENS  = 1_500;
const IMAGE_TOKEN_ESTIMATE = 500; // approximate tokens per image

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

type InputMessage = OpenAI.Responses.EasyInputMessage;
type InputContentPart = OpenAI.Responses.ResponseInputContent;

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
  return Math.min(MAX_RESPONSE_TOKENS, Math.max(available, 200));
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

// ─── Prompt Utilities ─────────────────────────────────────────────────────────

function formatResponse(text: string): string {
  return text.trim();
}

function buildSystemPrompt(correctBUName: string, policyContext: string, hasPolicies: boolean): string {
  const basePrompt     = `You are ${correctBUName}'s Policy Assistant.`;
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

// ─── Input Builder ────────────────────────────────────────────────────────────

function buildInputMessages(
  trimmedHistory: Message[],
  userMessage: string,
  imageAttachments?: ImageAttachment[]
): InputMessage[] {
  // System messages are passed via `instructions` — filter them from history to avoid duplication.
  const historyMessages: InputMessage[] = trimmedHistory
    .filter((msg) => msg.role !== "system")
    .map((msg) => {
      if (msg.role === "user" && msg.imageUrls && msg.imageUrls.length > 0) {
        const parts: InputContentPart[] = [
          { type: "input_text",  text: msg.content || "" },
          ...msg.imageUrls.map((url): OpenAI.Responses.ResponseInputImage => ({ type: "input_image", image_url: url, detail: "auto" })),
        ];
        return { role: "user" as const, content: parts };
      }
      return { role: msg.role as "user" | "assistant", content: msg.content };
    });

  // Current user turn — optionally multimodal
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
  businessUnit: string = "UFL",
  customSystemPrompt?: string
): Promise<string> {
  try {
    const buConfig       = getBusinessUnitConfig(businessUnit);
    const correctBUName  = buConfig ? formatBusinessUnit(businessUnit) : businessUnit;
    const trimmedHistory = trimConversationHistory(conversationHistory);
    const { policyContext, hasPolicies } = buildPolicyContext(policies);
    const instructions   = customSystemPrompt ?? buildSystemPrompt(correctBUName, policyContext, hasPolicies);
    const input          = buildInputMessages(trimmedHistory, userMessage);

    const usedTokens =
      estimateTokens(instructions) +
      estimateTokens(userMessage) +
      estimateTokens(trimmedHistory.map((m) => m.content).join(" ")) +
      trimmedHistory.reduce((sum, m) => sum + (m.imageUrls?.length ?? 0), 0) * IMAGE_TOKEN_ESTIMATE;

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 90_000);

    try {
      const response = await openai.responses.create({
        model: MODEL,
        instructions,
        input,

        max_output_tokens: computeMaxTokens(usedTokens),
      }, { signal: controller.signal });

      return formatResponse(extractOutputText(response));
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("aborted")) {
      throw new Error("Request timeout - please try again");
    }
    throw new Error("Failed to generate AI response");
  }
}

// ─── streamAIResponse ────────────────────────────────────────────────────────

export async function* streamAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "UFL",
  customSystemPrompt?: string,
  imageAttachments?: ImageAttachment[]
): AsyncGenerator<string, void, unknown> {
  try {
    const buConfig       = getBusinessUnitConfig(businessUnit);
    const correctBUName  = buConfig ? formatBusinessUnit(businessUnit) : businessUnit;
    const trimmedHistory = trimConversationHistory(conversationHistory);
    const { policyContext, hasPolicies } = buildPolicyContext(policies);
    const instructions   = customSystemPrompt ?? buildSystemPrompt(correctBUName, policyContext, hasPolicies);
    const input          = buildInputMessages(trimmedHistory, userMessage, imageAttachments);

    const imageCount =
      (imageAttachments?.length ?? 0) +
      trimmedHistory.reduce((sum, m) => sum + (m.imageUrls?.length ?? 0), 0);

    const usedTokens =
      estimateTokens(instructions) +
      estimateTokens(userMessage) +
      estimateTokens(trimmedHistory.map((m) => m.content).join(" ")) +
      imageCount * IMAGE_TOKEN_ESTIMATE;

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 90_000);

    try {
      const stream = openai.responses.stream({
        model: MODEL,
        instructions,
        input,
        max_output_tokens: computeMaxTokens(usedTokens),
      }, { signal: controller.signal });

      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          yield event.delta;
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("aborted")) {
      throw new Error("Request timeout - please try again");
    }
    console.error("[streamAIResponse] OpenAI error:", error);
    throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : String(error)}`);
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
        model: MODEL,
        instructions: "Create a brief title (5-10 words, professional). Return ONLY the title text.",
        input: [{ role: "user", content: `Title for: "${userMessage.substring(0, 100)}"` }],

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
