import OpenAI from "openai";
import logger from "../utils/logger";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_BATCH_SIZE = 100;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (err?.status === 429 || err?.status >= 500) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn(`[Embedding] Retrying after ${delay}ms (attempt ${attempt}/${MAX_RETRIES})`, {
          status: err?.status
        });
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}

// Tiny in-memory LRU for query embeddings — skips a 200–500ms OpenAI round-trip when a user
// repeats or rephrases slightly. 5-min TTL, 200-entry cap: cheap RAM, meaningful on the hot path.
type CacheEntry = { embedding: number[]; expiresAt: number };
const EMBED_CACHE_TTL_MS = 5 * 60 * 1000;
const EMBED_CACHE_MAX = 200;
const embedCache = new Map<string, CacheEntry>();

function cacheKey(text: string): string {
  return text.trim().toLowerCase();
}

function cacheGet(key: string): number[] | null {
  const hit = embedCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    embedCache.delete(key);
    return null;
  }
  // refresh recency (Map iteration order = insertion order; delete+set bumps to MRU)
  embedCache.delete(key);
  embedCache.set(key, hit);
  return hit.embedding;
}

function cacheSet(key: string, embedding: number[]) {
  embedCache.set(key, { embedding, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
  if (embedCache.size > EMBED_CACHE_MAX) {
    const oldest = embedCache.keys().next().value;
    if (oldest !== undefined) embedCache.delete(oldest);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const key = cacheKey(text);
  const cached = cacheGet(key);
  if (cached) return cached;

  const response = await withRetry(() =>
    openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS
    })
  );
  const embedding = response.data[0].embedding;
  cacheSet(key, embedding);
  return embedding;
}

export async function generateEmbeddingBatch(
  texts: string[],
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    logger.info(`[Embedding] Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} texts)`);

    const response = await withRetry(() =>
      openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS
      })
    );

    // OpenAI returns embeddings in the same order as input
    const batchEmbeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    results.push(...batchEmbeddings);
  }

  return results;
}
