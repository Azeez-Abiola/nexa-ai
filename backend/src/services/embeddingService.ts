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

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await withRetry(() =>
    openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS
    })
  );
  return response.data[0].embedding;
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
