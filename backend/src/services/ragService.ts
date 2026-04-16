import { Types } from "mongoose";
import { DocumentChunk } from "../models/DocumentChunk";
import { KnowledgeGroup } from "../models/KnowledgeGroup";
import { generateEmbedding } from "./embeddingService";
import logger from "../utils/logger";

export interface RAGQuery {
  query: string;
  businessUnit: string;
  userGrade: string;
  /** When set, knowledge-group restrictions on chunks are enforced */
  userId?: string;
  topK?: number;
}

export interface RetrievedChunk {
  content: string;
  score: number;
  documentTitle: string;
  documentType: string;
  chunkIndex: number;
  documentId: string;
  documentSeriesId?: string;
  version?: number;
  /** When false, chunk belongs to a superseded upload (kept for non-policy types) */
  isLatestVersion?: boolean;
}

/** Policy-like types: retrieval keeps only the latest version chunk set */
const LATEST_ONLY_DOCUMENT_TYPES = new Set(["policy", "procedure"]);

function applyLatestVersionFilter(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.filter((c) => {
    if (!LATEST_ONLY_DOCUMENT_TYPES.has(c.documentType)) return true;
    return c.isLatestVersion !== false;
  });
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

  const gradeOr = [
    { allowedGrades: { $size: 0 } },
    { allowedGrades: { $in: ["ALL"] } },
    { allowedGrades: { $in: [query.userGrade] } }
  ];

  const groupOr: Record<string, unknown>[] = [
    { allowedGroupIds: { $exists: false } },
    { allowedGroupIds: { $size: 0 } }
  ];
  if (query.userId && Types.ObjectId.isValid(query.userId)) {
    const uid = new Types.ObjectId(query.userId);
    const groups = await KnowledgeGroup.find({
      businessUnit: query.businessUnit,
      memberUserIds: uid
    })
      .select("_id")
      .lean();
    const ids = groups.map((g) => g._id as Types.ObjectId);
    if (ids.length > 0) {
      groupOr.push({ allowedGroupIds: { $in: ids } });
    }
  }

  const pipeline: any[] = [
    {
      $vectorSearch: {
        index: "document_chunks_vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: Math.min(Math.max(topK * 20, 40), 200),
        limit: Math.min(Math.max(topK * 10, 20), 100), // over-fetch; then threshold + version filter
        filter: {
          businessUnit: { $eq: query.businessUnit },
          $and: [{ $or: gradeOr }, { $or: groupOr }]
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
        "metadata.documentSeriesId": 1,
        "metadata.version": 1,
        "metadata.isLatestVersion": 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ];

  const rawResults = await DocumentChunk.aggregate(pipeline);
  const retrievalLatencyMs = Date.now() - retrievalStart;
  const totalLatencyMs = Date.now() - totalStart;

  const mapped = rawResults
    .filter((r: any) => r.score >= SCORE_THRESHOLD)
    .map((r: any) => ({
      content: r.content,
      score: r.score,
      documentTitle: r.metadata?.documentTitle || "Unknown",
      documentType: r.metadata?.documentType || "unknown",
      chunkIndex: r.chunkIndex,
      documentId: r.documentId?.toString() || "",
      documentSeriesId: r.metadata?.documentSeriesId || "",
      version: typeof r.metadata?.version === "number" ? r.metadata.version : 1,
      isLatestVersion: r.metadata?.isLatestVersion !== false
    }));

  const versionFiltered = applyLatestVersionFilter(mapped);
  const chunks: RetrievedChunk[] = versionFiltered.sort((a, b) => b.score - a.score).slice(0, topK);

  logger.info("[RAG] Retrieval complete", {
    query: query.query.substring(0, 80),
    businessUnit: query.businessUnit,
    userGrade: query.userGrade,
    userId: query.userId || null,
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
    const v =
      chunk.version != null && chunk.version > 1 ? ` — file version v${chunk.version}` : "";
    const superseded = chunk.isLatestVersion === false ? " (superseded upload)" : "";
    return [
      `[Chunk ${i + 1}] Source: ${chunk.documentTitle} (${chunk.documentType})${v}${superseded} — relevance: ${score}%`,
      chunk.content,
      "---"
    ].join("\n");
  });

  return `📋 RETRIEVED DOCUMENT CHUNKS:\n\n${lines.join("\n\n")}`;
}
