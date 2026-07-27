import { Model, PipelineStage } from "mongoose";

export interface UtilizationRow {
  businessUnit: string;
  activeUsers: number;
  conversations: number;
  messages: number;
  /** Assistant replies — one per LLM call, the basis for apportioning provider spend. */
  assistantMessages: number;
  /** Percentage of all LLM calls in the range, to 2dp. */
  shareOfLlmCalls: number;
}

export interface UtilizationRange {
  from?: Date;
  to?: Date;
}

/**
 * Platform activity per business unit.
 *
 * Shared by the super-admin endpoint and the CSV script so both report identical
 * numbers. Counts activity, not tokens — see `scripts/utilizationReport.ts` for
 * why, and what that means for cost allocation.
 *
 * Messages are nested two levels deep (user doc → conversationGroups → messages),
 * so the date filter has to be applied after unwinding to the message level.
 * Message *content* is encrypted at rest, but this never reads content — only
 * role and timestamp — so no decryption is involved.
 */
export async function buildUtilizationByBu(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversationModel: Model<any>,
  range: UtilizationRange = {}
): Promise<UtilizationRow[]> {
  const timestampMatch: Record<string, Date> = {};
  if (range.from) timestampMatch.$gte = range.from;
  if (range.to) timestampMatch.$lte = range.to;

  const pipeline: PipelineStage[] = [
    // Orphaned conversations from deleted users carry no businessUnit and cannot be
    // attributed to anyone, so they are excluded rather than shown as "(unassigned)".
    // The caller still gets their volume via `unattributedLlmCalls` so the drop is visible.
    { $match: { businessUnit: { $nin: [null, ""] } } },
    { $unwind: "$conversationGroups" },
    { $unwind: "$conversationGroups.messages" },
  ];

  if (Object.keys(timestampMatch).length > 0) {
    pipeline.push({ $match: { "conversationGroups.messages.timestamp": timestampMatch } });
  }

  pipeline.push(
    {
      $group: {
        _id: "$businessUnit",
        messages: { $sum: 1 },
        assistantMessages: {
          $sum: { $cond: [{ $eq: ["$conversationGroups.messages.role", "assistant"] }, 1, 0] },
        },
        users: { $addToSet: "$userId" },
        conversations: { $addToSet: "$conversationGroups._id" },
      },
    },
    {
      $project: {
        _id: 0,
        businessUnit: "$_id",
        messages: 1,
        assistantMessages: 1,
        activeUsers: { $size: "$users" },
        conversations: { $size: "$conversations" },
      },
    },
    { $sort: { assistantMessages: -1 } }
  );

  const rows = (await conversationModel.aggregate(pipeline)) as Omit<UtilizationRow, "shareOfLlmCalls">[];

  const totalCalls = rows.reduce((n, r) => n + r.assistantMessages, 0);
  return rows.map((r) => ({
    ...r,
    shareOfLlmCalls: totalCalls > 0 ? Math.round((r.assistantMessages / totalCalls) * 10000) / 100 : 0,
  }));
}

/**
 * LLM calls in the range that belong to no business unit — orphaned conversations
 * whose user was deleted. Excluded from the rows above; reported separately so the
 * excluded volume is never silently lost.
 */
export async function countUnattributedLlmCalls(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conversationModel: Model<any>,
  range: UtilizationRange = {}
): Promise<number> {
  const timestampMatch: Record<string, Date> = {};
  if (range.from) timestampMatch.$gte = range.from;
  if (range.to) timestampMatch.$lte = range.to;

  const pipeline: PipelineStage[] = [
    { $match: { businessUnit: { $in: [null, ""] } } },
    { $unwind: "$conversationGroups" },
    { $unwind: "$conversationGroups.messages" },
  ];

  if (Object.keys(timestampMatch).length > 0) {
    pipeline.push({ $match: { "conversationGroups.messages.timestamp": timestampMatch } });
  }

  pipeline.push({
    $group: {
      _id: null,
      assistantMessages: {
        $sum: { $cond: [{ $eq: ["$conversationGroups.messages.role", "assistant"] }, 1, 0] },
      },
    },
  });

  const [result] = (await conversationModel.aggregate(pipeline)) as { assistantMessages: number }[];
  return result?.assistantMessages ?? 0;
}
