import mongoose, { Schema, Document } from "mongoose";

/**
 * One row per LLM call: which business unit consumed what.
 *
 * Written fire-and-forget from the provider services, which is why nothing here is
 * required except the fields we can always determine. `estimatedCostUsd` is null
 * for models with no configured rate (see config/modelPricing.ts) — tokens are
 * still exact, so cost can be backfilled later by re-pricing.
 */
export interface UsageRecordDocument extends Document {
  businessUnit: string;
  provider: "gpt" | "claude" | "kimi" | "deepseek";
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  /** Prompt-cache reads (billed ~0.1x input). Anthropic only; 0 elsewhere. */
  cacheReadTokens: number;
  /** Prompt-cache writes (billed 1.25x–2x input). Anthropic only; 0 elsewhere. */
  cacheWriteTokens: number;
  estimatedCostUsd: number | null;
  /** "stream" or "generate" — useful when reconciling against provider invoices. */
  mode: string;
  createdAt: Date;
}

const UsageRecordSchema = new Schema<UsageRecordDocument>(
  {
    businessUnit: { type: String, required: true, index: true, trim: true },
    provider: { type: String, required: true, index: true },
    modelId: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cacheReadTokens: { type: Number, default: 0 },
    cacheWriteTokens: { type: Number, default: 0 },
    estimatedCostUsd: { type: Number, default: null },
    mode: { type: String, default: "stream" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The report always slices by business unit over a date range.
UsageRecordSchema.index({ businessUnit: 1, createdAt: -1 });
UsageRecordSchema.index({ createdAt: -1 });

export const UsageRecord = mongoose.model<UsageRecordDocument>("UsageRecord", UsageRecordSchema);
