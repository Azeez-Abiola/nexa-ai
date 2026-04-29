import mongoose, { Schema, Document } from "mongoose";

export interface DocumentCategoryDocument extends Document {
  /** Stable lowercase slug used as documentType on RagDocument (e.g. "policy", "operational_report"). */
  name: string;
  /** Display label shown in admin UI (e.g. "Policy", "Operational reports"). */
  label: string;
  businessUnit: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentCategorySchema = new Schema<DocumentCategoryDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_]+$/, "name must be lowercase letters, digits, and underscores only"]
    },
    label: { type: String, required: true, trim: true },
    businessUnit: { type: String, required: true, trim: true, index: true },
    tenantId: { type: String, default: "" }
  },
  { timestamps: true }
);

DocumentCategorySchema.index({ businessUnit: 1, name: 1 }, { unique: true });

export const DocumentCategory = mongoose.model<DocumentCategoryDocument>(
  "DocumentCategory",
  DocumentCategorySchema
);

/**
 * Built-in categories that always exist for every BU. Stored only as a constant
 * (not seeded into Mongo) so the universal set can evolve without per-tenant migrations.
 * Custom categories admins create are persisted via DocumentCategory and merged into
 * GET /categories alongside these.
 */
export const BUILTIN_DOCUMENT_CATEGORIES = [
  { name: "policy", label: "Policy" },
  { name: "report", label: "Financial reports" },
  { name: "operational_report", label: "Operational reports" },
  { name: "procedure", label: "S&OP / procedure" },
  { name: "handbook", label: "Handbook" },
  { name: "contract", label: "Contact" },
  { name: "other", label: "Other" }
] as const;

export const BUILTIN_NAMES = new Set(BUILTIN_DOCUMENT_CATEGORIES.map((c) => c.name));
