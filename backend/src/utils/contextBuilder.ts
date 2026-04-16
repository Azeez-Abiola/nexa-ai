import { Policy } from "../models/Policy";
import { searchGoogle, buildHybridContext, formatSearchResultsForChat } from "../services/googleSearchService";
import { retrieveRelevantChunks, buildRAGContext, RetrievedChunk } from "../services/ragService";
import logger from "./logger";

export interface ContextBuildResult {
  hybridContextString: string;
  ragChunks: RetrievedChunk[];
  policies: any[];
  googleResults: any[];
  accessDenied: boolean;
  source: "rag" | "keyword" | "google_only" | "none";
  googleFooter: string;
}

export interface ContextBuildOptions {
  useRAG?: boolean;
  useGoogle?: boolean;
  topK?: number;
  /** Employee user id — used for knowledge-group access on RAG chunks */
  userId?: string;
}

// Filter policies by grade — keeps existing semantics
function filterPoliciesByGrade(policies: any[], userGrade?: string): { accessible: any[]; restricted: any[] } {
  const accessible: any[] = [];
  const restricted: any[] = [];
  for (const policy of policies) {
    const grades: string[] = policy.allowedGrades ?? [];
    if (grades.length === 0 || grades.includes("ALL") || !userGrade) {
      accessible.push(policy);
    } else if (grades.includes(userGrade)) {
      accessible.push(policy);
    } else {
      restricted.push(policy);
    }
  }
  return { accessible, restricted };
}

async function keywordSearch(query: string, businessUnit: string): Promise<any[]> {
  try {
    return await Policy.find(
      { businessUnit, $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(3)
      .lean();
  } catch {
    // Fallback to regex if full-text index unavailable
    const patterns = query.split(/\s+/).filter((w) => w.length > 2);
    if (patterns.length === 0) return [];
    const regex = patterns.join("|");
    return Policy.find({
      businessUnit,
      $or: [
        { title: { $regex: regex, $options: "i" } },
        { content: { $regex: regex, $options: "i" } },
        { category: { $regex: regex, $options: "i" } }
      ]
    })
      .limit(3)
      .lean();
  }
}

export async function buildContextForQuery(
  query: string,
  businessUnit: string,
  userGrade: string,
  options: ContextBuildOptions = {}
): Promise<ContextBuildResult> {
  const { useRAG = true, useGoogle = true, topK, userId } = options;

  let ragChunks: RetrievedChunk[] = [];
  let policies: any[] = [];
  let googleResults: any[] = [];
  let accessDenied = false;
  let source: ContextBuildResult["source"] = "none";

  // KB first. Google is a fallback — it only runs if nothing in the company knowledge base answers
  // the question. Saves 500–1500ms per message and keeps responses grounded in company sources.
  // Skipped `isRAGAvailable` precheck — vector search returns empty gracefully when there are no chunks,
  // and the countDocuments round-trip was adding 50–150ms on the critical path for zero correctness gain.
  if (useRAG) {
    try {
      const ragOutcome = await retrieveRelevantChunks({ query, businessUnit, userGrade, userId, topK });
      if (ragOutcome?.chunks?.length) {
        ragChunks = ragOutcome.chunks;
        source = "rag";
      }
    } catch (err) {
      logger.error("[ContextBuilder] RAG retrieval failed", { error: (err as Error).message });
    }
  }

  // Keyword search on legacy Policy collection — only used when RAG had nothing.
  if (ragChunks.length === 0) {
    try {
      const allPolicies = await keywordSearch(query, businessUnit);
      const { accessible, restricted } = filterPoliciesByGrade(allPolicies, userGrade);

      if (accessible.length > 0) {
        policies = accessible;
        source = "keyword";
      } else if (restricted.length > 0) {
        accessDenied = true;
      }
    } catch (err) {
      logger.error("[ContextBuilder] Keyword search failed", { error: (err as Error).message });
    }
  }

  // Google only runs when the KB (RAG + keyword) produced nothing. Skipped for access-denied too,
  // since the user's answer should come from the company source and not a public fallback.
  const kbEmpty = ragChunks.length === 0 && policies.length === 0;
  if (useGoogle && kbEmpty && !accessDenied) {
    try {
      const googleOutcome = await searchGoogle(query, 3);
      if (googleOutcome?.success) {
        googleResults = googleOutcome.results || [];
        if (googleResults.length > 0) source = "google_only";
      }
    } catch (err) {
      logger.error("[ContextBuilder] Google search failed", { error: (err as Error).message });
    }
  }

  // Build the context string for the LLM prompt
  let hybridContextString = "";

  if (ragChunks.length > 0) {
    hybridContextString = buildRAGContext(ragChunks);
    if (googleResults.length > 0) {
      hybridContextString += "\n\n" + buildHybridContext([], googleResults);
    }
  } else if (policies.length > 0 || googleResults.length > 0) {
    hybridContextString = buildHybridContext(policies, googleResults);
  }

  const googleFooter = googleResults.length > 0 ? formatSearchResultsForChat(googleResults) : "";

  return { hybridContextString, ragChunks, policies, googleResults, accessDenied, source, googleFooter };
}
