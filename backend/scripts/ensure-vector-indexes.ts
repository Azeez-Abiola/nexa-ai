/**
 * Creates the Atlas Vector Search indexes defined in atlas-vector-search-index.json
 * if they don't already exist on the connected cluster. Safe to re-run — skips
 * any index that is already present.
 *
 *   npx ts-node scripts/ensure-vector-indexes.ts
 */

import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

type IndexSpec = {
  _comment?: string;
  name: string;
  type: "vectorSearch";
  definition: { fields: unknown[] };
  collection?: string;
};

const COLLECTION_FOR_INDEX: Record<string, string> = {
  document_chunks_vector_index: "documentchunks",
  user_document_chunks_vector_index: "userdocumentchunks"
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in backend/.env");
    process.exit(1);
  }

  const configPath = path.resolve(__dirname, "..", "atlas-vector-search-index.json");
  const config: IndexSpec[] = JSON.parse(fs.readFileSync(configPath, "utf8"));

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error("No DB handle after connect");
    process.exit(1);
  }

  for (const spec of config) {
    const collectionName = spec.collection || COLLECTION_FOR_INDEX[spec.name];
    if (!collectionName) {
      console.warn(`  ${spec.name}: no target collection known — skipping`);
      continue;
    }
    const col = db.collection(collectionName);

    let existing: { name: string }[] = [];
    try {
      existing = (await col.listSearchIndexes().toArray()) as { name: string }[];
    } catch (err: any) {
      console.warn(`  ${spec.name}: listSearchIndexes failed — ${err?.message || err}`);
    }

    if (existing.some((idx) => idx.name === spec.name)) {
      console.log(`  ${spec.name} on ${collectionName}: already exists ✓`);
      continue;
    }

    console.log(`  ${spec.name} on ${collectionName}: creating…`);
    await col.createSearchIndex({
      name: spec.name,
      type: spec.type,
      definition: spec.definition
    });
    console.log(`    → created. Atlas may take 30–90s to finish building before it's queryable.`);
  }

  await mongoose.disconnect();
  console.log("\nDone. If you just created indexes, wait ~1 minute before querying.");
}

main().catch((err) => {
  console.error("ensure-vector-indexes failed:", err);
  process.exit(1);
});
