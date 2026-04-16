import mongoose, { Schema, Document, Types } from "mongoose";

export interface DocumentChunkDocument extends Document {
  documentId: Types.ObjectId;
  businessUnit: string;
  allowedGrades: string[];
  /** Empty = all BU users (subject to grade rules). Non-empty = only members of these user groups. */
  allowedGroupIds: Types.ObjectId[];
  sensitivityLevel: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding: number[];
  metadata: {
    documentTitle: string;
    documentType: string;
    /** Same logical document across versions (mirrors RagDocument) */
    documentSeriesId?: string;
    version?: number;
    isLatestVersion?: boolean;
    pageNumber?: number;
    sourceRange: {
      start: number;
      end: number;
    };
  };
  createdAt: Date;
}

const DocumentChunkSchema = new Schema<DocumentChunkDocument>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "RagDocument", required: true, index: true },
    businessUnit: { type: String, required: true, index: true, trim: true },
    allowedGrades: { type: [String], default: [] },
    allowedGroupIds: { type: [{ type: Schema.Types.ObjectId, ref: "KnowledgeGroup" }], default: [] },
    sensitivityLevel: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    tokenCount: { type: Number, required: true },
    // embedding is a flat array of 1536 floats indexed by Atlas Vector Search
    // Atlas manages the vector index separately — no Mongoose-level index needed
    embedding: { type: [Number], required: true },
    metadata: {
      documentTitle: { type: String, required: true },
      documentType: { type: String, required: true },
      documentSeriesId: { type: String, default: "" },
      version: { type: Number, default: 1 },
      isLatestVersion: { type: Boolean, default: true },
      pageNumber: { type: Number, default: null },
      sourceRange: {
        start: { type: Number, required: true },
        end: { type: Number, required: true }
      }
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const DocumentChunk = mongoose.model<DocumentChunkDocument>("DocumentChunk", DocumentChunkSchema);