import mongoose, { Schema, Document, Types } from "mongoose";

export type AuditEventType =
  | "document_upload_completed"
  | "document_processing_started"
  | "document_processing_completed"
  | "document_processing_failed"
  | "rag_query"
  | "rag_retrieval_empty"
  | "rag_access_denied"
  | "chunk_embedding_batch_completed";

export interface AuditLogDocument extends Document {
  eventType: AuditEventType;
  userId?: string;
  adminId?: string;
  businessUnit: string;
  documentId?: Types.ObjectId;
  metadata: Record<string, any>;
  createdAt: Date;
}

const AuditLogSchema = new Schema<AuditLogDocument>(
  {
    eventType: {
      type: String,
      enum: [
        "document_upload_completed",
        "document_processing_started",
        "document_processing_completed",
        "document_processing_failed",
        "rag_query",
        "rag_retrieval_empty",
        "rag_access_denied",
        "chunk_embedding_batch_completed"
      ],
      required: true
    },
    userId: { type: String, default: null },
    adminId: { type: String, default: null },
    businessUnit: { type: String, required: true },
    documentId: { type: Schema.Types.ObjectId, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound indexes for efficient querying
AuditLogSchema.index({ eventType: 1, createdAt: -1 });
AuditLogSchema.index({ businessUnit: 1, createdAt: -1 });
AuditLogSchema.index({ documentId: 1 });
// TTL: auto-delete logs after 90 days
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export const AuditLog = mongoose.model<AuditLogDocument>("AuditLog", AuditLogSchema);
