import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Repairs the unique index on `microsoftId` for users and adminusers.
 *
 * The original schema declared `microsoftId` as `{ default: null, unique: true,
 * sparse: true }`. A sparse index only skips documents where the field is
 * absent, but `default: null` writes an explicit null into every document — so
 * all of them were indexed and the second account created without Microsoft SSO
 * collided with the first ("E11000 dup key: { microsoftId: null }"), breaking
 * employee invite acceptance.
 *
 * The schema now declares a partial index filtered on `$type: "string"`, which
 * excludes both null and absent values. Mongoose cannot apply that on its own:
 * it never drops or alters an existing index, and creating one with the same
 * name but different options fails with IndexOptionsConflict. This script does
 * the drop-and-recreate once, per collection.
 *
 * Safe to re-run — each step is skipped if already in the desired state.
 *
 * Run with:
 *   npx ts-node --transpile-only src/scripts/fixMicrosoftIdIndex.ts
 */

const INDEX_NAME = "microsoftId_1";
const PARTIAL_FILTER = { microsoftId: { $type: "string" } };
const COLLECTIONS = ["users", "adminusers"];

/** True when the live index already matches what the schema now declares. */
function isDesiredIndex(index: any): boolean {
  const filter = index.partialFilterExpression;
  return (
    index.unique === true &&
    !index.sparse &&
    filter?.microsoftId?.$type === "string"
  );
}

async function fixCollection(collectionName: string) {
  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle on the mongoose connection");

  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length === 0) {
    console.log(`[${collectionName}] collection does not exist — skipping.`);
    return;
  }

  const collection = db.collection(collectionName);
  const indexes = await collection.indexes();
  const existing = indexes.find((i) => i.name === INDEX_NAME);

  if (existing && isDesiredIndex(existing)) {
    console.log(`[${collectionName}] ${INDEX_NAME} is already a partial unique index — nothing to do.`);
    return;
  }

  if (existing) {
    console.log(`[${collectionName}] dropping ${INDEX_NAME} (${JSON.stringify(existing)})`);
    await collection.dropIndex(INDEX_NAME);
  } else {
    console.log(`[${collectionName}] ${INDEX_NAME} not present — creating it.`);
  }

  // Clear the explicit nulls left behind by the old `default: null`. The partial
  // filter would tolerate them, but leaving them means every document carries a
  // field it never uses, and `$exists`-based queries elsewhere would misreport.
  const cleared = await collection.updateMany(
    { microsoftId: null },
    { $unset: { microsoftId: "" } }
  );
  console.log(`[${collectionName}] cleared ${cleared.modifiedCount} null microsoftId field(s).`);

  // Surface pre-existing genuine duplicates rather than failing opaquely on
  // createIndex — two accounts bound to the same Azure AD object id is a real
  // data problem that needs a human decision, not a migration.
  const duplicates = await collection
    .aggregate([
      { $match: { microsoftId: { $type: "string" } } },
      { $group: { _id: "$microsoftId", count: { $sum: 1 }, emails: { $push: "$email" } } },
      { $match: { count: { $gt: 1 } } }
    ])
    .toArray();

  if (duplicates.length > 0) {
    console.error(`[${collectionName}] cannot create unique index — duplicate microsoftId values found:`);
    for (const dup of duplicates) {
      console.error(`  ${dup._id} -> ${dup.emails.join(", ")}`);
    }
    throw new Error(
      `[${collectionName}] resolve the duplicates above, then re-run this script.`
    );
  }

  await collection.createIndex(
    { microsoftId: 1 },
    { unique: true, partialFilterExpression: PARTIAL_FILTER, name: INDEX_NAME }
  );
  console.log(`[${collectionName}] recreated ${INDEX_NAME} as a partial unique index.`);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set in .env");

  await mongoose.connect(uri);
  console.log(`Connected to MongoDB (${new URL(uri).hostname})`);

  try {
    for (const collectionName of COLLECTIONS) {
      await fixCollection(collectionName);
    }
    console.log("Done.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
