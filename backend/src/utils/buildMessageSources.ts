import { createHash } from "crypto";
import mongoose from "mongoose";
import { RagDocument } from "../models/RagDocument";
import type { RetrievedChunk } from "../services/ragService";

export interface MessageSourcePayload {
  documentId: string;
  title: string;
  documentType: string;
  version?: number;
  url?: string;
}

const MIN_SOURCE_SCORE = 0.72;
const MAX_SOURCES = 5;

function webSourceId(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 24);
}

/** Build deduplicated source pills from RAG chunks. */
export async function buildRagMessageSources(
  ragChunks: RetrievedChunk[]
): Promise<MessageSourcePayload[]> {
  const chunkByDocId = new Map<string, RetrievedChunk>();
  for (const c of ragChunks) {
    if (!c.documentId) continue;
    if ((c.score ?? 0) < MIN_SOURCE_SCORE) continue;
    const prev = chunkByDocId.get(c.documentId);
    if (!prev || (prev.score ?? 0) < (c.score ?? 0)) chunkByDocId.set(c.documentId, c);
  }
  if (chunkByDocId.size === 0) return [];

  const ids = Array.from(chunkByDocId.keys()).filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (ids.length === 0) return [];

  const docs = await RagDocument.find({ _id: { $in: ids } })
    .select("_id title documentType version cloudinaryUrl")
    .lean();
  const docMap = new Map(docs.map((d: any) => [String(d._id), d]));

  const ranked = Array.from(chunkByDocId.entries())
    .sort(([, a], [, b]) => (b.score ?? 0) - (a.score ?? 0))
    .map(([id, c]) => {
      const d: any = docMap.get(id);
      return {
        documentId: id,
        title: d?.title || c.documentTitle || "Untitled",
        documentType: d?.documentType || c.documentType || "other",
        version: d?.version ?? c.version,
        url: d?.cloudinaryUrl,
      };
    });

  const seenTitles = new Set<string>();
  return ranked
    .filter((s) => {
      const key = s.title.trim().toLowerCase();
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return true;
    })
    .slice(0, MAX_SOURCES);
}

/** Build source pills from web search results. */
export function buildWebMessageSources(
  googleResults: Array<{ title?: string; link?: string }>
): MessageSourcePayload[] {
  const seen = new Set<string>();
  const sources: MessageSourcePayload[] = [];

  for (const r of googleResults) {
    const link = r.link?.trim();
    if (!link || seen.has(link)) continue;
    seen.add(link);
    sources.push({
      documentId: webSourceId(link),
      title: r.title?.trim() || link,
      documentType: "web",
      url: link,
    });
    if (sources.length >= MAX_SOURCES) break;
  }

  return sources;
}
