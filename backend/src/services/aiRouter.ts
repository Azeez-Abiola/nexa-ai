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
