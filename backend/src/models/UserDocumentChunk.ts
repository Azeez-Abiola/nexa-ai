import mongoose, { Schema, Document, Types } from "mongoose";

export interface UserDocumentChunkDocument extends Document {
  documentId: Types.ObjectId;
  userId: string;
  chatSessionId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  // flat array of 1536 floats; indexed by MongoDB Atlas Vector Search
  embedding: number[];
  metadata: {
    documentTitle: string;
    fileName: string;
    pageNumber?: number;
    sourceRange: {
      start: number;
      end: number;
    };
  };
  createdAt: Date;
}

const UserDocumentChunkSchema = new Schema<UserDocumentChunkDocument>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "UserDocument",
      required: true,
      index: true
    },
    userId: { type: String, required: true, index: true },
    chatSessionId: { type: String, required: true, index: true },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    tokenCount: { type: Number, required: true },
    embedding: { type: [Number], required: true },
    metadata: {
      documentTitle: { type: String, required: true },
      fileName: { type: String, required: true },
      pageNumber: { type: Number, default: null },
      sourceRange: {
        start: { type: Number, required: true },
        end: { type: Number, required: true }
      }
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Composite index for efficient session-scoped queries
UserDocumentChunkSchema.index({ userId: 1, chatSessionId: 1 });
UserDocumentChunkSchema.index({ documentId: 1 });

export const UserDocumentChunk = mongoose.model<UserDocumentChunkDocument>(
  "UserDocumentChunk",
  UserDocumentChunkSchema
);
