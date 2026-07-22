import { Policy } from "../models/Policy";
import { retrieveRelevantChunks, buildRAGContext, RetrievedChunk } from "../services/ragService";
import logger from "./logger";

export interface ContextBuildResult {
  hybridContextString: string;
  ragChunks: RetrievedChunk[];
  policies: any[];
  accessDenied: boolean;
  source: "rag" | "keyword" | "none";
}

export interface ContextBuildOptions {
  useRAG?: boolean;
  topK?: number;
  /** Employee user id — used for knowledge-group access on RAG chunks */
  userId?: string;
  /** Employee department — used as a relevance boost (soft gate) on RAG chunks. */
  userDepartment?: string;
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

/** Format legacy keyword-matched policies into a context block for the prompt. */
function buildPolicyContext(policies: any[]): string {
  if (!policies || policies.length === 0) return "";
  let context = "📋 **COMPANY POLICIES & INTERNAL DOCUMENTS:**\n";
  context += "=".repeat(41) + "\n";
  policies.forEach((policy, idx) => {
    context += `\n[POLICY ${idx + 1}] ${policy.title}\n`;
    context += `Category: ${policy.category}\n`;
    context += `Content:\n${policy.content}\n`;
    context += "-".repeat(41) + "\n";
  });
  return context;
}

export async function buildContextForQuery(
  query: string,
  businessUnit: string,
  options: ContextBuildOptions = {}
): Promise<ContextBuildResult> {
  const { useRAG = true, topK, userId, userDepartment } = options;

  let ragChunks: RetrievedChunk[] = [];
  let policies: any[] = [];
  const accessDenied = false;
  let source: ContextBuildResult["source"] = "none";

  if (useRAG) {
    try {
      const ragOutcome = await retrieveRelevantChunks({ query, businessUnit, userId, topK, userDepartment });
      if (ragOutcome?.chunks?.length) {
        ragChunks = ragOutcome.chunks;
        source = "rag";
      }
    } catch (err) {
      logger.error("[ContextBuilder] RAG retrieval failed", { error: (err as Error).message });
    }
  }

  const KEYWORD_MIN_SCORE = 1.5;
  if (ragChunks.length === 0) {
    try {
      const allPolicies = await keywordSearch(query, businessUnit);
      const strong = allPolicies.filter((p: any) => (p.score ?? 0) >= KEYWORD_MIN_SCORE);

      if (strong.length > 0) {
        policies = strong;
        source = "keyword";
      }
    } catch (err) {
      logger.error("[ContextBuilder] Keyword search failed", { error: (err as Error).message });
    }
  }

  // Build the context string for the LLM prompt
  let hybridContextString = "";
  if (ragChunks.length > 0) {
    hybridContextString = buildRAGContext(ragChunks);
  } else if (policies.length > 0) {
    hybridContextString = buildPolicyContext(policies);
  }

  logger.info("[ContextBuilder] Context built", {
    query: query.slice(0, 80),
    businessUnit,
    source,
    ragChunks: ragChunks.length,
    policies: policies.length,
    accessDenied
  });

  return { hybridContextString, ragChunks, policies, accessDenied, source };
}
