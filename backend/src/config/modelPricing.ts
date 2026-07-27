/**
 * Per-model token pricing, in USD per 1M tokens.
 *
 * Anthropic rates are published and stable, so they are hard-coded. Rates for the
 * other providers are intentionally absent rather than guessed — a wrong number in
 * a cost report is worse than no number. Supply them via env when you have them:
 *
 *   MODEL_PRICE_GPT_5=1.25:10          # input:output USD per 1M tokens
 *   MODEL_PRICE_KIMI_K2_5=0.6:2.5
 *   MODEL_PRICE_DEEPSEEK_V4_FLASH=0.27:1.1
 *
 * Token counts are always recorded. Cost is only computed for models with a known
 * rate; everything else reports tokens with a null cost, so the gap is visible
 * rather than silently zero.
 */

export interface ModelRate {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
}

/** Anthropic prompt-cache multipliers, applied to the input rate. */
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25; // 5-minute TTL; the 1h TTL is 2x

const BUILT_IN_RATES: Record<string, ModelRate> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** `MODEL_PRICE_<MODEL_ID>` with non-alphanumerics as underscores, value "input:output". */
function envRate(modelId: string): ModelRate | undefined {
  const key = `MODEL_PRICE_${modelId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
  const raw = process.env[key];
  if (!raw) return undefined;

  const [input, output] = raw.split(":").map(Number);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return undefined;
  return { input, output };
}

/** Published rate for a model, or undefined when we don't have one. */
export function rateFor(modelId: string): ModelRate | undefined {
  return envRate(modelId) ?? BUILT_IN_RATES[modelId];
}

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

/**
 * Estimated USD for one request, or null when the model has no configured rate.
 *
 * Cached input is billed differently from fresh input, so the three input buckets
 * are priced separately rather than summed.
 */
export function estimateCostUsd(modelId: string, tokens: TokenCounts): number | null {
  const rate = rateFor(modelId);
  if (!rate) return null;

  const perToken = rate.input / 1_000_000;
  const cost =
    tokens.inputTokens * perToken +
    tokens.cacheReadTokens * perToken * CACHE_READ_MULTIPLIER +
    tokens.cacheWriteTokens * perToken * CACHE_WRITE_MULTIPLIER +
    (tokens.outputTokens * rate.output) / 1_000_000;

  // Sub-cent precision matters when aggregating thousands of calls.
  return Math.round(cost * 1_000_000) / 1_000_000;
}
