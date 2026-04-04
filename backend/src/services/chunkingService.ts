import { getEncoding } from "js-tiktoken";
import { parse } from "csv-parse/sync";

export interface ChunkOptions {
  targetTokens?: number;
  maxTokens?: number;
  minTokens?: number;
  overlapTokens?: number;
}

export interface ChunkResult {
  content: string;
  tokenCount: number;
  chunkIndex: number;
  sourceRange: { start: number; end: number };
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  targetTokens: parseInt(process.env.RAG_CHUNK_TARGET_TOKENS || "500"),
  maxTokens: parseInt(process.env.RAG_CHUNK_MAX_TOKENS || "800"),
  minTokens: parseInt(process.env.RAG_CHUNK_MIN_TOKENS || "100"),
  overlapTokens: parseInt(process.env.RAG_CHUNK_OVERLAP_TOKENS || "50")
};

// Split text into sentences, preserving the delimiter
function splitSentences(text: string): string[] {
  const raw = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return raw;
}

function countTokens(enc: ReturnType<typeof getEncoding>, text: string): number {
  return enc.encode(text).length;
}

export function chunkText(text: string, options?: ChunkOptions): ChunkResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const enc = getEncoding("cl100k_base");

  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    // js-tiktoken is pure JS (no WASM), so no manual memory release needed
    return [];
  }

  const chunks: ChunkResult[] = [];
  let currentSentences: string[] = [];
  let currentTokens = 0;
  let currentStart = 0;
  let charOffset = 0;

  // Track character offsets per sentence
  const sentenceOffsets: { start: number; end: number }[] = [];
  {
    let pos = 0;
    for (const s of sentences) {
      const idx = text.indexOf(s, pos);
      const start = idx >= 0 ? idx : pos;
      const end = start + s.length;
      sentenceOffsets.push({ start, end });
      pos = end;
    }
  }

  function flushChunk(sentenceSlice: string[], startIdx: number, endIdx: number) {
    if (sentenceSlice.length === 0) return;
    const content = sentenceSlice.join(" ").trim();
    const tokenCount = countTokens(enc, content);
    const start = sentenceOffsets[startIdx]?.start ?? 0;
    const end = sentenceOffsets[endIdx]?.end ?? content.length;
    chunks.push({
      content,
      tokenCount,
      chunkIndex: chunks.length,
      sourceRange: { start, end }
    });
  }

  let sentenceStart = 0;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const toks = countTokens(enc, s);

    if (currentTokens + toks > opts.maxTokens && currentSentences.length > 0) {
      flushChunk(currentSentences, sentenceStart, sentenceStart + currentSentences.length - 1);

      // Overlap: back-track sentences whose combined tokens ≤ overlapTokens
      const overlapSentences: string[] = [];
      let overlapTokens = 0;
      for (let j = currentSentences.length - 1; j >= 0; j--) {
        const t = countTokens(enc, currentSentences[j]);
        if (overlapTokens + t > opts.overlapTokens) break;
        overlapSentences.unshift(currentSentences[j]);
        overlapTokens += t;
      }

      sentenceStart = sentenceStart + currentSentences.length - overlapSentences.length;
      currentSentences = [...overlapSentences];
      currentTokens = overlapTokens;
    }

    currentSentences.push(s);
    currentTokens += toks;
  }

  // Flush remaining sentences
  if (currentSentences.length > 0) {
    const endIdx = sentenceStart + currentSentences.length - 1;
    flushChunk(currentSentences, sentenceStart, endIdx);
  }

  // Merge any trailing chunk that is too small into the previous one
  if (chunks.length > 1 && chunks[chunks.length - 1].tokenCount < opts.minTokens) {
    const last = chunks.pop()!;
    const prev = chunks[chunks.length - 1];
    const merged = (prev.content + " " + last.content).trim();
    prev.content = merged;
    prev.tokenCount = countTokens(enc, merged);
    prev.sourceRange.end = last.sourceRange.end;
  }

  // enc.free() — not available on this version of js-tiktoken
  return chunks;
}

export async function parseCSV(buffer: Buffer): Promise<string> {
  const records: Record<string, string>[] = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });

  return records
    .map((row, i) => {
      const pairs = Object.entries(row)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      return `Row ${i + 1}: ${pairs}`;
    })
    .join("\n");
}
