import * as openai from "./openaiService";
import * as claude from "./claudeService";
import * as kimiService from "./kimiService";
import * as deepseekService from "./deepseekService";

export type AIModel = "gpt" | "claude" | "kimi" | "deepseek";

export function parseModel(raw: unknown): AIModel {
  if (raw === "claude") return "claude";
  if (raw === "kimi") return "kimi";
  if (raw === "deepseek") return "deepseek";
  return "gpt";
}

export function getStreamAIResponse(model: AIModel) {
  if (model === "claude") return claude.streamAIResponse;
  if (model === "kimi") return kimiService.streamAIResponse;
  if (model === "deepseek") return deepseekService.streamAIResponse;
  return openai.streamAIResponse;
}

export function getGenerateAIResponse(model: AIModel) {
  if (model === "claude") return claude.generateAIResponse;
  if (model === "kimi") return kimiService.generateAIResponse;
  if (model === "deepseek") return deepseekService.generateAIResponse;
  return openai.generateAIResponse;
}

/** The model id actually in use for this provider (env-resolved, same value the service sends). */
export function getModelId(model: AIModel): string {
  if (model === "claude") return claude.MODEL;
  if (model === "kimi") return kimiService.MODEL;
  if (model === "deepseek") return deepseekService.MODEL;
  return openai.MODEL;
}

// Display names for known model ids. Anything not listed falls back to the raw id,
// so the label can never claim a model that isn't the one actually serving the request.
const MODEL_LABELS: Record<string, string> = {
  "gpt-5": "GPT-5",
  "gpt-4.1": "GPT-4.1",
  "claude-opus-4-8": "Claude Opus 4.8",
  "claude-opus-4-7": "Claude Opus 4.7",
  "claude-opus-4-6": "Claude Opus 4.6",
  "claude-sonnet-5": "Claude Sonnet 5",
  "kimi-k2.5": "Kimi k2.5",
  "deepseek-v4-flash": "DeepSeek v4"
};

/**
 * Human-readable label for the model actually configured for this provider.
 * Derived from the real (env-resolved) model id rather than hardcoded, so what the
 * assistant reports about itself cannot drift from what is really answering.
 */
export function getModelLabel(model: AIModel): string {
  const id = getModelId(model);
  return MODEL_LABELS[id] || id;
}
