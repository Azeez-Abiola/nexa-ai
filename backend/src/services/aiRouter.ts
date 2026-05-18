import * as openai from "./openaiService";
import * as claude from "./claudeService";

export type AIModel = "gpt" | "claude";

export function parseModel(raw: unknown): AIModel {
  return raw === "claude" ? "claude" : "gpt";
}

export function getStreamAIResponse(model: AIModel) {
  return model === "claude" ? claude.streamAIResponse : openai.streamAIResponse;
}

export function getGenerateAIResponse(model: AIModel) {
  return model === "claude" ? claude.generateAIResponse : openai.generateAIResponse;
}
