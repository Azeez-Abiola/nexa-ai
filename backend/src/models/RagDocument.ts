import mongoose, { Schema, Document } from "mongoose";

export type DocumentType = "policy" | "procedure" | "handbook" | "contract" | "report" | "other";
export type SensitivityLevel = "public" | "internal" | "confidential" | "restricted";
export type ProcessingStatus = "pending" | "extracting" | "chunking" | "embedding" | "completed" | "failed";

export interface RagDocumentDocument extends Document {
  title: string;
  businessUnit: string;
  documentType: DocumentType;
  sensitivityLevel: SensitivityLevel;
  allowedGrades: string[];
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
    businessUnit: { type: String, required: true, index: true },
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
    allowedGrades: {
      type: [String],
      enum: ["Executive", "Senior VP", "VP", "Associate", "Senior Analyst", "Analyst"],
      default: []
    },
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
      enum: ["pending", "extracting", "chunking", "embedding", "completed", "failed"],
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

export const RagDocument = mongoose.model<RagDocumentDocument>("RagDocument", RagDocumentSchema);
