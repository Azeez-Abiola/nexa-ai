import { DocumentChunk } from "../models/DocumentChunk";
import { generateEmbedding } from "./embeddingService";
import logger from "../utils/logger";

export interface RAGQuery {
  query: string;
  businessUnit: string;
  userGrade: string;
  topK?: number;
}

export interface RetrievedChunk {
  content: string;
  score: number;
  documentTitle: string;
  documentType: string;
  chunkIndex: number;
  documentId: string;
}

export interface RAGResult {
  chunks: RetrievedChunk[];
  queryEmbeddingLatencyMs: number;
  retrievalLatencyMs: number;
  totalLatencyMs: number;
}

const SCORE_THRESHOLD = parseFloat(process.env.RAG_SCORE_THRESHOLD || "0.75");
const DEFAULT_TOP_K = parseInt(process.env.RAG_TOP_K || "5");

/**
 * Check if there are any completed chunks in the vector store for the given BU.
 * Used for graceful fallback to keyword search.
 */
export async function isRAGAvailable(businessUnit: string): Promise<boolean> {
  try {
    const count = await DocumentChunk.countDocuments({ businessUnit });
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Retrieve the most relevant document chunks for a query using MongoDB Atlas Vector Search.
 * Access control (businessUnit + grade) is enforced inside the $vectorSearch filter clause.
 */
export async function retrieveRelevantChunks(query: RAGQuery): Promise<RAGResult> {
  const topK = query.topK ?? DEFAULT_TOP_K;
  const totalStart = Date.now();

  // Step 1: Embed the query
  const embeddingStart = Date.now();
  const queryEmbedding = await generateEmbedding(query.query);
  const queryEmbeddingLatencyMs = Date.now() - embeddingStart;

  // Step 2: Atlas Vector Search with pre-filter
  const retrievalStart = Date.now();

  const pipeline: any[] = [
    {
      $vectorSearch: {
        index: "document_chunks_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: topK * 10, // over-fetch for better recall
        limit: topK * 2, // fetch more, then apply score threshold
        filter: {
          businessUnit: { $eq: query.businessUnit },
          $or: [
            { allowedGrades: { $size: 0 } },              // empty = open to all grades
            { allowedGrades: { $in: ["ALL"] } },           // explicitly granted to all
            { allowedGrades: { $in: [query.userGrade] } }  // or user's grade is listed
          ]
        }
      }
    },
    {
      $project: {
        content: 1,
        chunkIndex: 1,
        documentId: 1,
        "metadata.documentTitle": 1,
        "metadata.documentType": 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ];

  const rawResults = await DocumentChunk.aggregate(pipeline);
  const retrievalLatencyMs = Date.now() - retrievalStart;
  const totalLatencyMs = Date.now() - totalStart;

  // Filter by score threshold and take topK
  const chunks: RetrievedChunk[] = rawResults
    .filter((r: any) => r.score >= SCORE_THRESHOLD)
    .slice(0, topK)
    .map((r: any) => ({
      content: r.content,
      score: r.score,
      documentTitle: r.metadata?.documentTitle || "Unknown",
      documentType: r.metadata?.documentType || "unknown",
      chunkIndex: r.chunkIndex,
      documentId: r.documentId?.toString() || ""
    }));

  logger.info("[RAG] Retrieval complete", {
    query: query.query.substring(0, 80),
    businessUnit: query.businessUnit,
    userGrade: query.userGrade,
    chunksReturned: chunks.length,
    topScore: chunks[0]?.score ?? 0,
    queryEmbeddingLatencyMs,
    retrievalLatencyMs
  });

  return { chunks, queryEmbeddingLatencyMs, retrievalLatencyMs, totalLatencyMs };
}

/**
 * Format retrieved chunks into a context block for the LLM system prompt.
 */
export function buildRAGContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const lines = chunks.map((chunk, i) => {
    const score = (chunk.score * 100).toFixed(0);
    return [
      `[Chunk ${i + 1}] Source: ${chunk.documentTitle} (${chunk.documentType}) — relevance: ${score}%`,
      chunk.content,
      "---"
    ].join("\n");
  });

  return `📋 RETRIEVED DOCUMENT CHUNKS:\n\n${lines.join("\n\n")}`;
}
