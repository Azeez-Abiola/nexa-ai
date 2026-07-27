import { UsageRecord } from "../models/UsageRecord";
import { estimateCostUsd } from "../config/modelPricing";
import logger from "../utils/logger";

/**
 * Records per-request token consumption so utilization can be reported by business
 * unit with real numbers instead of message-count proxies.
 *
 * Every call is fire-and-forget and swallows its own errors: usage accounting must
 * never fail a user's request.
 */

export type Provider = "gpt" | "claude" | "kimi" | "deepseek";

/**
 * The three SDK shapes we have to normalise:
 *   Anthropic          input_tokens / output_tokens / cache_read_input_tokens / cache_creation_input_tokens
 *   OpenAI Responses   input_tokens / output_tokens
 *   OpenAI Chat        prompt_tokens / completion_tokens   (Kimi, DeepSeek)
 */
export function normalizeUsage(usage: unknown): {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
} | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, any>;

  const inputTokens = Number(u.input_tokens ?? u.prompt_tokens ?? 0) || 0;
  const outputTokens = Number(u.output_tokens ?? u.completion_tokens ?? 0) || 0;
  const cacheReadTokens = Number(u.cache_read_input_tokens ?? 0) || 0;
  const cacheWriteTokens = Number(u.cache_creation_input_tokens ?? 0) || 0;

  if (inputTokens === 0 && outputTokens === 0 && cacheReadTokens === 0 && cacheWriteTokens === 0) {
    return null;
  }
  return { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens };
}

export function recordUsage(opts: {
  businessUnit: string;
  provider: Provider;
  modelId: string;
  usage: unknown;
  mode?: "stream" | "generate";
}): void {
  const tokens = normalizeUsage(opts.usage);
  if (!tokens) return;

  // Orphan attribution is what produced "(unassigned)" rows in the activity report;
  // label it explicitly here rather than writing an empty string.
  const businessUnit = opts.businessUnit?.trim() || "(unattributed)";

  UsageRecord.create({
    businessUnit,
    provider: opts.provider,
    modelId: opts.modelId,
    ...tokens,
    estimatedCostUsd: estimateCostUsd(opts.modelId, tokens),
    mode: opts.mode ?? "stream",
  }).catch((err) => {
    logger.warn("[Usage] Failed to record usage", {
      provider: opts.provider,
      modelId: opts.modelId,
      error: (err as Error).message,
    });
  });
}
