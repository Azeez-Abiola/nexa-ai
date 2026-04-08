import mongoose, { Schema, Document } from "mongoose";

export type UserDocumentStatus = "pending" | "processing" | "ready" | "failed";

export interface UserDocumentDocument extends Document {
  userId: string;
  chatSessionId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  cloudinaryPublicId: string;
  status: UserDocumentStatus;
  processingError?: string;
  totalChunks: number;
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserDocumentSchema = new Schema<UserDocumentDocument>(
  {
    userId: { type: String, required: true, index: true },
    chatSessionId: { type: String, required: true, index: true },
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    cloudinaryPublicId: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "ready", "failed"],
      default: "pending",
      index: true
    },
    processingError: { type: String, default: null },
    totalChunks: { type: Number, default: 0 },
    summary: { type: String, default: null }
  },
  { timestamps: true }
);

UserDocumentSchema.index({ userId: 1, chatSessionId: 1 });
UserDocumentSchema.index({ chatSessionId: 1, status: 1 });

export const UserDocument = mongoose.model<UserDocumentDocument>("UserDocument", UserDocumentSchema);
