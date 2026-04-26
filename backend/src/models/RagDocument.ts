import mongoose, { Schema, Document, Types } from "mongoose";

export type DocumentType = "policy" | "procedure" | "handbook" | "contract" | "report" | "other";
export type SensitivityLevel = "public" | "internal" | "confidential" | "restricted";
export type ProcessingStatus =
  | "pending"
  | "extracting"
  | "chunking"
  | "embedding"
  | "completed"
  | "failed"
  | "superseded";

export interface RagDocumentDocument extends Document {
  title: string;
  businessUnit: string;
  documentType: DocumentType;
  sensitivityLevel: SensitivityLevel;
  /** Stable id for all versions of the same logical document */
  documentSeriesId: string;
  version: number;
  isLatestVersion: boolean;
  supersedesDocumentId?: Types.ObjectId | null;
  allowedGroupIds: Types.ObjectId[];
  uploadedBy: {
    adminId: string;
    adminEmail: string;
    adminName: string;
  };
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  processingStatus: ProcessingStatus;
  processingError?: string;
  processingJobId?: string;
  totalChunks: number;
  embeddedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RagDocumentSchema = new Schema<RagDocumentDocument>(
  {
    title: { type: String, required: true },
    businessUnit: { type: String, required: true, index: true, trim: true },
    documentType: {
      type: String,
      enum: ["policy", "procedure", "handbook", "contract", "report", "other"],
      required: true
    },
    sensitivityLevel: {
      type: String,
      enum: ["public", "internal", "confidential", "restricted"],
      required: true
    },
    documentSeriesId: { type: String, index: true, default: "" },
    version: { type: Number, default: 1 },
    isLatestVersion: { type: Boolean, default: true, index: true },
    supersedesDocumentId: { type: Schema.Types.ObjectId, ref: "RagDocument", default: null },
    allowedGroupIds: [{ type: Schema.Types.ObjectId, ref: "KnowledgeGroup", default: [] }],
    uploadedBy: {
      adminId: { type: String, required: true },
      adminEmail: { type: String, required: true },
      adminName: { type: String, required: true }
    },
    cloudinaryPublicId: { type: String, required: true },
    cloudinaryUrl: { type: String, required: true },
    originalFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    processingStatus: {
      type: String,
      enum: ["pending", "extracting", "chunking", "embedding", "completed", "failed", "superseded"],
      default: "pending",
      index: true
    },
    processingError: { type: String, default: null },
    processingJobId: { type: String, default: null },
    totalChunks: { type: Number, default: 0 },
    embeddedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

RagDocumentSchema.index({ businessUnit: 1, sensitivityLevel: 1 });
RagDocumentSchema.index({ documentSeriesId: 1, version: -1 });

RagDocumentSchema.pre("validate", function (next) {
  const d = this as RagDocumentDocument;
  if (!d.documentSeriesId) {
    d.documentSeriesId = new Types.ObjectId().toString();
  }
  if (d.version == null || d.version < 1) {
    d.version = 1;
  }
  if (d.isLatestVersion == null) {
    d.isLatestVersion = true;
  }
  if (!d.allowedGroupIds) d.allowedGroupIds = [];
  next();
});

export const RagDocument = mongoose.model<RagDocumentDocument>("RagDocument", RagDocumentSchema);
