/**
 * Migration: re-embed all document chunks using Voyage AI (voyage-3-lite, 512 dims)
 * Replaces stale OpenAI text-embedding-3-small vectors (1536 dims) in place.
 *
 * Run: npx ts-node --transpile-only src/scripts/migrateEmbeddings.ts
 *
 * Prerequisites:
 *  - VOYAGE_API_KEY set in .env
 *  - MONGODB_URI set in .env
 *  - MongoDB Atlas vector indexes already recreated with dimensions: 512
 */

import "dotenv/config";
import mongoose from "mongoose";
import { DocumentChunk } from "../models/DocumentChunk";
import { UserDocumentChunk } from "../models/UserDocumentChunk";
import { generateEmbeddingBatch } from "../services/embeddingService";

const BATCH_SIZE = 16;
const DELAY_BETWEEN_BATCHES_MS = 5000; // 5s — respects Voyage free tier rate limit
const MONGODB_URI = process.env.MONGODB_URI!;

async function reembedCollection(
  model: mongoose.Model<any>,
  label: string
) {
  const total = await model.countDocuments();
  console.log(`\n[${label}] ${total} chunks to process`);

  let processed = 0;
  let cursor = model.find({}, { _id: 1, content: 1 }).lean().cursor();

  let batch: { _id: any; content: string }[] = [];

  const processBatch = async () => {
    if (batch.length === 0) return;

    const texts = batch.map(doc => doc.content);
    const embeddings = await generateEmbeddingBatch(texts);

    const ops = batch.map((doc, i) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { embedding: embeddings[i] } },
      },
    }));

    await model.bulkWrite(ops, { ordered: false });
    processed += batch.length;
    console.log(`[${label}] ${processed}/${total} done`);
    batch = [];
    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
  };

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await processBatch();
    }
  }

  await processBatch(); // flush remainder
  console.log(`[${label}] Complete — ${processed} chunks re-embedded`);
}

async function main() {
  if (!process.env.VOYAGE_API_KEY) {
    console.error("Error: VOYAGE_API_KEY is not set in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected.");

  await reembedCollection(DocumentChunk, "KnowledgeBase");
  await reembedCollection(UserDocumentChunk, "UserDocuments");

  await mongoose.disconnect();
  console.log("\nMigration complete. Remember to recreate your Atlas vector indexes with dimensions: 512");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
