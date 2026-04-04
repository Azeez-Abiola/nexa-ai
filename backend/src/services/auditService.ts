import { AuditLog, AuditEventType } from "../models/AuditLog";
import { RAGResult } from "./ragService";
import logger from "../utils/logger";

export interface AuditPayload {
  userId?: string;
  adminId?: string;
  businessUnit: string;
  documentId?: string;
  metadata?: Record<string, any>;
}

// Fire-and-forget: never blocks the request path, never throws
function fireAndForget(fn: () => Promise<void>): void {
  setImmediate(() => {
    fn().catch((err) => {
      logger.error("[Audit] Failed to write audit log", { error: err.message });
    });
  });
}

export function logEvent(eventType: AuditEventType, payload: AuditPayload): void {
  fireAndForget(async () => {
    await AuditLog.create({
      eventType,
      userId: payload.userId || null,
      adminId: payload.adminId || null,
      businessUnit: payload.businessUnit,
      documentId: payload.documentId || null,
      metadata: payload.metadata || {}
    });
  });
}

export function logRAGQuery(
  userId: string,
  businessUnit: string,
  query: string,
  result: RAGResult
): void {
  logEvent("rag_query", {
    userId,
    businessUnit,
    metadata: {
      query: query.substring(0, 200),
      chunksRetrieved: result.chunks.length,
      topScores: result.chunks.slice(0, 5).map((c) => parseFloat(c.score.toFixed(3))),
      queryEmbeddingLatencyMs: result.queryEmbeddingLatencyMs,
      retrievalLatencyMs: result.retrievalLatencyMs,
      totalLatencyMs: result.totalLatencyMs
    }
  });

  if (result.chunks.length === 0) {
    logEvent("rag_retrieval_empty", { userId, businessUnit, metadata: { query: query.substring(0, 200) } });
  }
}

export function logDocumentUpload(
  adminId: string,
  businessUnit: string,
  documentId: string,
  meta: { filename: string; fileSize: number; mimeType: string; cloudinaryPublicId: string }
): void {
  logEvent("document_upload_completed", {
    adminId,
    businessUnit,
    documentId,
    metadata: meta
  });
}

export function logProcessingStarted(documentId: string, businessUnit: string, jobId: string): void {
  logEvent("document_processing_started", { businessUnit, documentId, metadata: { jobId } });
}

export function logProcessingCompleted(documentId: string, businessUnit: string, totalChunks: number): void {
  logEvent("document_processing_completed", { businessUnit, documentId, metadata: { totalChunks } });
}

export function logProcessingFailed(documentId: string, businessUnit: string, error: string, jobId?: string): void {
  logEvent("document_processing_failed", { businessUnit, documentId, metadata: { error, jobId } });
}
