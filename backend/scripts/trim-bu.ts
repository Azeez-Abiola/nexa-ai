/**
 * Trim leading/trailing whitespace from `businessUnit` (and BusinessUnit.name/label)
 * across every collection where it's stored as a string. One-off migration.
 *
 *   npx ts-node scripts/trim-bu.ts --dry-run   (default — counts only, no writes)
 *   npx ts-node scripts/trim-bu.ts --apply     (performs the updates)
 *
 * Safe to re-run: it only targets rows where the value differs from its trimmed form,
 * so a clean DB results in zero updates.
 */

import dotenv from "dotenv";
import path from "path";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

type Target = {
  collection: string;
  field: string;
  sampleProjection?: Record<string, 1>;
};

const TARGETS: Target[] = [
  { collection: "ragdocuments", field: "businessUnit", sampleProjection: { title: 1 } },
  { collection: "documentchunks", field: "businessUnit" },
  { collection: "users", field: "businessUnit", sampleProjection: { email: 1 } },
  { collection: "adminusers", field: "businessUnit", sampleProjection: { email: 1 } },
  { collection: "policies", field: "businessUnit", sampleProjection: { title: 1 } },
  { collection: "conversations", field: "businessUnit" },
  { collection: "sharedconversations", field: "businessUnit" },
  { collection: "auditlogs", field: "businessUnit" },
  { collection: "employeeinvites", field: "businessUnit", sampleProjection: { email: 1 } },
  { collection: "admininvites", field: "businessUnit", sampleProjection: { email: 1 } },
  { collection: "businessunitemailmappings", field: "businessUnit", sampleProjection: { emailDomain: 1 } },
  { collection: "knowledgegroups", field: "businessUnit", sampleProjection: { name: 1 } },
  { collection: "businessunits", field: "name", sampleProjection: { name: 1, slug: 1 } },
  { collection: "businessunits", field: "label", sampleProjection: { name: 1, label: 1 } }
];

const WHITESPACE_FILTER = (field: string) => ({
  [field]: { $regex: /^\s+|\s+$/ }
});

async function main() {
  const apply = process.argv.includes("--apply");
  const mode = apply ? "APPLY" : "DRY-RUN";

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in backend/.env");
    process.exit(1);
  }

  console.log(`[trim-bu] Mode: ${mode}`);
  console.log(`[trim-bu] Connecting to Mongo…`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error("Failed to get DB handle after connect");
    process.exit(1);
  }

  let totalAffected = 0;

  for (const { collection, field, sampleProjection } of TARGETS) {
    const coll = db.collection(collection);
    const filter = WHITESPACE_FILTER(field);

    const count = await coll.countDocuments(filter);

    if (count === 0) {
      console.log(`  ${collection}.${field}: clean (0 rows)`);
      continue;
    }

    totalAffected += count;
    console.log(`  ${collection}.${field}: ${count} row(s) would be trimmed`);

    if (sampleProjection) {
      const samples = await coll
        .find(filter, { projection: { ...sampleProjection, [field]: 1 } })
        .limit(3)
        .toArray();
      for (const s of samples) {
        const raw = s[field];
        const rendered = typeof raw === "string" ? JSON.stringify(raw) : raw;
        console.log(`      e.g. ${collection} ${rendered} → ${JSON.stringify(String(raw).trim())}`);
      }
    }

    if (apply) {
      const result = await coll.updateMany(filter, [
        { $set: { [field]: { $trim: { input: `$${field}` } } } }
      ]);
      console.log(`      → updated ${result.modifiedCount} row(s)`);
    }
  }

  console.log("");
  if (!apply) {
    console.log(`[trim-bu] DRY-RUN complete. ${totalAffected} row(s) total would be modified.`);
    console.log(`[trim-bu] Re-run with --apply to perform the updates.`);
  } else {
    console.log(`[trim-bu] APPLY complete. ${totalAffected} row(s) touched.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[trim-bu] Failed:", err);
  process.exit(1);
});
