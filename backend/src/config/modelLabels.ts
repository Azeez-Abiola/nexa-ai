/**
 * Display names for known model ids.
 *
 * Lives in `config/` rather than `aiRouter` so the provider services can resolve
 * a label without importing the router (which imports them — a require cycle).
 *
 * Anything not listed falls back to the raw id, so the label can never claim a
 * model that isn't the one actually serving the request.
 */
export const MODEL_LABELS: Record<string, string> = {
  "gpt-5": "GPT-5",
  "gpt-4.1": "GPT-4.1",
  "claude-opus-4-8": "Claude Opus 4.8",
  "claude-opus-4-7": "Claude Opus 4.7",
  "claude-opus-4-6": "Claude Opus 4.6",
  "claude-sonnet-5": "Claude Sonnet 5",
  "kimi-k2.5": "Kimi k2.5",
  "deepseek-v4-flash": "DeepSeek v4"
};

/** Human-readable label for a resolved (env-configured) model id. */
export function labelForModelId(modelId: string): string {
  return MODEL_LABELS[modelId] || modelId;
}
