import { UserDocumentChunk } from "../models/UserDocumentChunk";
import { UserDocument } from "../models/UserDocument";
import { generateEmbedding } from "./embeddingService";
import logger from "../utils/logger";

export interface SessionRAGQuery {
  query: string;
  userId: string;
  chatSessionId: string;
  topK?: number;
}

export interface SessionRetrievedChunk {
  content: string;
  score: number;
  fileName: string;
  chunkIndex: number;
  documentId: string;
}

export interface SessionRAGResult {
  chunks: SessionRetrievedChunk[];
  queryEmbeddingLatencyMs: number;
  retrievalLatencyMs: number;
  totalLatencyMs: number;
}

export interface SessionDocumentStatus {
  totalDocs: number;
  pendingOrProcessing: string[]; // filenames
  ready: number;
  failed: string[]; // filenames
}

const SCORE_THRESHOLD = parseFloat(process.env.SESSION_RAG_SCORE_THRESHOLD || process.env.RAG_SCORE_THRESHOLD || "0.70");
const DEFAULT_TOP_K = parseInt(process.env.RAG_TOP_K || "5");

/**
 * Check if the session has any ready chunks to search against.
 */
export async function hasReadySessionChunks(userId: string, chatSessionId: string): Promise<boolean> {
  try {
    const count = await UserDocumentChunk.countDocuments({ userId, chatSessionId });
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Get status of all documents in a session — used to warn users about pending docs.
 */
export async function getSessionDocumentStatus(
  userId: string,
  chatSessionId: string
): Promise<SessionDocumentStatus> {
  const docs = await UserDocument.find(
    { userId, chatSessionId },
    { fileName: 1, status: 1 }
  ).lean();

  const pendingOrProcessing = docs
    .filter((d) => d.status === "pending" || d.status === "processing")
    .map((d) => d.fileName);

  const failed = docs
    .filter((d) => d.status === "failed")
    .map((d) => d.fileName);

  const ready = docs.filter((d) => d.status === "ready").length;

  return { totalDocs: docs.length, pendingOrProcessing, ready, failed };
}

/**
 * Retrieve the most relevant user-uploaded document chunks for a query.
 * Strictly filtered by userId + chatSessionId for session isolation.
 *
 * Requires the MongoDB Atlas Vector Search index:
 *   name: "user_document_chunks_vector_index"
 *   collection: "userdocumentchunks"
 * See: backend/src/config/user-document-chunks-vector-index.json
 */
export async function retrieveSessionChunks(query: SessionRAGQuery): Promise<SessionRAGResult> {
  const topK = query.topK ?? DEFAULT_TOP_K;
  const totalStart = Date.now();

  // Embed the user query
  const embeddingStart = Date.now();
  const queryEmbedding = await generateEmbedding(query.query);
  const queryEmbeddingLatencyMs = Date.now() - embeddingStart;

  const retrievalStart = Date.now();

  const pipeline: any[] = [
    {
      $vectorSearch: {
        index: "user_document_chunks_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: topK * 10,
        limit: topK * 2,
        filter: {
          // Strict session isolation — enforced BEFORE LLM receives context
          userId: { $eq: query.userId },
          chatSessionId: { $eq: query.chatSessionId }
        }
      }
    },
    {
      $project: {
        content: 1,
        chunkIndex: 1,
        documentId: 1,
        "metadata.fileName": 1,
        "metadata.documentTitle": 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ];

  let rawResults: any[] = [];
  try {
    rawResults = await UserDocumentChunk.aggregate(pipeline);
  } catch (err: any) {
    // Gracefully degrade if the Atlas index isn't set up yet
    logger.warn("[SessionRAG] Vector search failed — Atlas index may not be configured", {
      error: err.message,
      userId: query.userId,
      chatSessionId: query.chatSessionId
    });
    return {
      chunks: [],
      queryEmbeddingLatencyMs,
      retrievalLatencyMs: Date.now() - retrievalStart,
      totalLatencyMs: Date.now() - totalStart
    };
  }

  const retrievalLatencyMs = Date.now() - retrievalStart;
  const totalLatencyMs = Date.now() - totalStart;

  // Apply score threshold and limit to topK
  const chunks: SessionRetrievedChunk[] = rawResults
    .filter((r: any) => r.score >= SCORE_THRESHOLD)
    .slice(0, topK)
    .map((r: any) => ({
      content: r.content,
      score: r.score,
      fileName: r.metadata?.fileName || r.metadata?.documentTitle || "Unknown",
      chunkIndex: r.chunkIndex,
      documentId: r.documentId?.toString() || ""
    }));

  logger.info("[SessionRAG] Retrieval complete", {
    query: query.query.substring(0, 80),
    userId: query.userId,
    chatSessionId: query.chatSessionId,
    chunksReturned: chunks.length,
    topScore: chunks[0]?.score ?? 0,
    queryEmbeddingLatencyMs,
    retrievalLatencyMs
  });

  return { chunks, queryEmbeddingLatencyMs, retrievalLatencyMs, totalLatencyMs };
}

/**
 * Format session document chunks into a context block for injection into the LLM prompt.
 */
export function buildSessionRAGContext(chunks: SessionRetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const lines = chunks.map((chunk, i) => {
    const score = (chunk.score * 100).toFixed(0);
    return [
      `[Chunk ${i + 1}] File: "${chunk.fileName}" — relevance: ${score}%`,
      chunk.content,
      "---"
    ].join("\n");
  });

  return `📄 YOUR UPLOADED DOCUMENTS (SESSION CONTEXT):\n\n${lines.join("\n\n")}`;
}
