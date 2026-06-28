import { createHash } from "crypto";
import logger from "../utils/logger";
import { redisConnection } from "../queue/connection";

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!;
const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

const EMBEDDING_MODEL = "voyage-3-lite";
export const EMBEDDING_DIMENSIONS = 512;
const DEFAULT_BATCH_SIZE = 128;
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

async function voyageEmbed(input: string | string[]): Promise<number[][]> {
  return withRetry(async () => {
    const res = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${VOYAGE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error(`[Embedding] Voyage error ${res.status}: ${body}`);
      const err: any = new Error(`Voyage API error: ${res.status}`);
      err.status = res.status;
      throw err;
    }

    const json = await res.json() as { data: { embedding: number[]; index: number }[] };
    return json.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
  });
}

// ── L1: in-memory LRU (sub-ms hits for the hottest queries) ──────────────────
type CacheEntry = { embedding: number[]; expiresAt: number };
const EMBED_CACHE_TTL_MS = 5 * 60 * 1000;
const EMBED_CACHE_MAX = 200;
const embedCache = new Map<string, CacheEntry>();

// ── In-flight deduplication ───────────────────────────────────────────────────
const inFlight = new Map<string, Promise<number[]>>();

function normalizeKey(text: string): string {
  return createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
}

function l1Get(key: string): number[] | null {
  const hit = embedCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) { embedCache.delete(key); return null; }
  embedCache.delete(key);
  embedCache.set(key, hit);
  return hit.embedding;
}

function l1Set(key: string, embedding: number[]) {
  embedCache.set(key, { embedding, expiresAt: Date.now() + EMBED_CACHE_TTL_MS });
  if (embedCache.size > EMBED_CACHE_MAX) {
    const oldest = embedCache.keys().next().value;
    if (oldest !== undefined) embedCache.delete(oldest);
  }
}

// ── L2: Redis (shared across instances, survives restarts) ───────────────────
const REDIS_EMBED_PREFIX = "emb:v3:";
const REDIS_EMBED_TTL_S = 10 * 60;

async function l2Get(key: string): Promise<number[] | null> {
  try {
    const raw = await redisConnection.get(REDIS_EMBED_PREFIX + key);
    return raw ? (JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}

async function l2Set(key: string, embedding: number[]): Promise<void> {
  try {
    await redisConnection.set(REDIS_EMBED_PREFIX + key, JSON.stringify(embedding), "EX", REDIS_EMBED_TTL_S);
  } catch {
    // ignore — cache is best-effort
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const key = normalizeKey(text);

  const l1 = l1Get(key);
  if (l1) return l1;

  const l2 = await l2Get(key);
  if (l2) {
    l1Set(key, l2);
    return l2;
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = voyageEmbed(text)
    .then((embeddings) => {
      const embedding = embeddings[0];
      l1Set(key, embedding);
      void l2Set(key, embedding);
      inFlight.delete(key);
      return embedding;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });

  inFlight.set(key, promise);
  return promise;
}

export async function generateEmbeddingBatch(
  texts: string[],
  batchSize: number = DEFAULT_BATCH_SIZE
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    logger.info(`[Embedding] Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} texts)`);
    const embeddings = await voyageEmbed(batch);
    results.push(...embeddings);
  }

  return results;
}
