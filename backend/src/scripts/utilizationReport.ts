import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { Conversation } from "../models/Conversation";
import {
  buildUtilizationByBu,
  countUnattributedLlmCalls,
  UtilizationRow,
} from "../services/utilizationService";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/**
 * Per-business-unit platform utilization, as CSV.
 *
 *   npm run report:utilization                      # all time
 *   npm run report:utilization -- --from 2026-07-01 # since a date
 *   npm run report:utilization -- --from 2026-07-01 --to 2026-07-27 --out report.csv
 *
 * IMPORTANT — what this does and does not measure.
 * It counts *activity* (conversations, messages, assistant replies, active users),
 * not tokens or spend: per-request token usage is not yet persisted, so there is no
 * historical cost data to report. `assistantMessages` is the count of LLM calls and
 * is the best available basis for apportioning a provider invoice across BUs.
 * Once UsageRecord data accumulates, report on that instead.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function parseDate(value: string | undefined, label: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid --${label} date: ${value}`);
  return d;
}

function toCsv(rows: UtilizationRow[]): string {
  const header = [
    "Business Unit",
    "Active Users",
    "Conversations",
    "Total Messages",
    "Assistant Replies (LLM calls)",
    "Share of LLM Calls (%)",
  ];
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) =>
    [r.businessUnit, r.activeUsers, r.conversations, r.messages, r.assistantMessages, r.shareOfLlmCalls]
      .map(escape)
      .join(",")
  );
  return [header.join(","), ...body].join("\n");
}

async function main(): Promise<void> {
  const from = parseDate(arg("from"), "from");
  const to = parseDate(arg("to"), "to");
  const out = arg("out");

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  await mongoose.connect(uri);
  try {
    const [rows, unattributed] = await Promise.all([
      buildUtilizationByBu(Conversation, { from, to }),
      countUnattributedLlmCalls(Conversation, { from, to }),
    ]);
    const csv = toCsv(rows);

    const range = `${from ? from.toISOString().slice(0, 10) : "start"} → ${
      to ? to.toISOString().slice(0, 10) : "now"
    }`;
    const totalCalls = rows.reduce((n, r) => n + r.assistantMessages, 0);

    if (out) {
      fs.writeFileSync(out, csv + "\n");
      console.log(`Wrote ${rows.length} business unit(s) to ${out}`);
    } else {
      console.log(csv);
    }
    console.error(`\nRange: ${range}   Business units: ${rows.length}   LLM calls: ${totalCalls}`);
    if (unattributed > 0) {
      console.error(
        `Excluded: ${unattributed} call(s) from deleted users with no business unit.`
      );
    }
    console.error(
      "Note: activity counts only — token/cost data is not captured historically. " +
        "Apportion the provider invoice using the 'Share of LLM Calls' column."
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error("Utilization report failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
