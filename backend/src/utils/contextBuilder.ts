import { Policy } from "../models/Policy";
import { searchGoogle, buildHybridContext, formatSearchResultsForChat } from "../services/googleSearchService";
import { retrieveRelevantChunks, buildRAGContext, isRAGAvailable, RetrievedChunk } from "../services/ragService";
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
}

// Filter policies by grade — keeps existing semantics
function filterPoliciesByGrade(policies: any[], userGrade?: string): { accessible: any[]; restricted: any[] } {
  const accessible: any[] = [];
  const restricted: any[] = [];
  for (const policy of policies) {
    if (!policy.allowedGrades || policy.allowedGrades.length === 0 || !userGrade) {
      accessible.push(policy);
    } else if (policy.allowedGrades.includes(userGrade)) {
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
  const { useRAG = true, useGoogle = true, topK } = options;

  let ragChunks: RetrievedChunk[] = [];
  let policies: any[] = [];
  let googleResults: any[] = [];
  let accessDenied = false;
  let source: ContextBuildResult["source"] = "none";

  // Run RAG + Google in parallel
  const [ragOutcome, googleOutcome] = await Promise.allSettled([
    useRAG
      ? (async () => {
          const ragAvailable = await isRAGAvailable(businessUnit);
          if (!ragAvailable) return null;
          return retrieveRelevantChunks({ query, businessUnit, userGrade, topK });
        })()
      : Promise.resolve(null),
    useGoogle ? searchGoogle(query, 3) : Promise.resolve({ success: false, results: [] })
  ]);

  // Process RAG result
  if (ragOutcome.status === "fulfilled" && ragOutcome.value?.chunks?.length) {
    ragChunks = ragOutcome.value.chunks;
    source = "rag";
  } else {
    // RAG unavailable or returned nothing — fall back to keyword search on Policy collection
    try {
      const allPolicies = await keywordSearch(query, businessUnit);
      const { accessible, restricted } = filterPoliciesByGrade(allPolicies, userGrade);

      if (accessible.length > 0) {
        policies = accessible;
        source = "keyword";
      } else if (restricted.length > 0) {
        // Documents exist but user's grade isn't allowed
        accessDenied = true;
      }
    } catch (err) {
      logger.error("[ContextBuilder] Keyword search failed", { error: (err as Error).message });
    }
  }

  // Process Google result
  if (googleOutcome.status === "fulfilled" && googleOutcome.value?.success) {
    googleResults = googleOutcome.value.results || [];
  }

  if (source === "none" && googleResults.length > 0) {
    source = "google_only";
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
