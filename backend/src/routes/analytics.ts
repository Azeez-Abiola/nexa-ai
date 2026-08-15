import express, { Response } from "express";
import { User } from "../models/User";
import { AdminUser } from "../models/AdminUser";
import { Conversation } from "../models/Conversation";
import { Policy } from "../models/Policy";
import { RagDocument } from "../models/RagDocument";
import { BusinessUnit } from "../models/BusinessUnit";
import { BusinessUnitEmailMapping } from "../models/BusinessUnitEmailMapping";
import {
  adminAuthMiddleware,
  superAdminMiddleware,
  AuthenticatedRequest
} from "../middleware/auth";
import { resolveUserDirectoryBusinessUnit } from "../utils/tenantResolution";
import { buildUtilizationByBu, countUnattributedLlmCalls } from "../services/utilizationService";
import logger from "../utils/logger";
import { validatePasswordStrength } from "../utils/passwordPolicy";
import bcrypt from "bcryptjs";

export const analyticsRouter = express.Router();

analyticsRouter.get("/dashboard", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const canonicalBU =
      !isSuperAdmin && businessUnit ? await resolveUserDirectoryBusinessUnit(req, undefined) : null;
    const effectiveBU = canonicalBU || businessUnit;
    const buFilter = isSuperAdmin ? {} : { businessUnit: effectiveBU };

    const adminScope = isSuperAdmin ? {} : { businessUnit: effectiveBU };

    const [
      totalUsers,
      totalAdmins,
      totalConversations,
      totalPolicies,
      totalTenants,
      totalDocs,
      usersWhoChatted,
      activeAdmins,
      inactiveAdmins
    ] = await Promise.all([
      User.countDocuments(buFilter),
      AdminUser.countDocuments(adminScope),
      Conversation.countDocuments(buFilter),
      Policy.countDocuments(buFilter),
      BusinessUnit.countDocuments(isSuperAdmin ? {} : { name: effectiveBU }),
      RagDocument.countDocuments(buFilter),
      Conversation.countDocuments({
        ...buFilter,
        conversationGroups: {
          $elemMatch: { "messages.0": { $exists: true } }
        }
      }),
      AdminUser.countDocuments({ ...adminScope, isActive: true }),
      AdminUser.countDocuments({ ...adminScope, isActive: false })
    ]);

    res.json({
      totalUsers,
      totalAdmins,
      totalConversations,
      totalPolicies,
      totalTenants,
      totalDocs,
      /** Users with at least one chat message sent or received (not just empty threads). */
      usersWhoChatted,
      /** Admins with account enabled vs disabled (deactivated). */
      activeAdmins,
      inactiveAdmins,
      scope: isSuperAdmin ? "platform" : "businessUnit",
      businessUnit: isSuperAdmin ? null : effectiveBU
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

analyticsRouter.get("/business-units", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;

    let buNames: string[] = [];
    if (isSuperAdmin) {
      const busFromDB = await BusinessUnit.find().select("name").lean();
      buNames = busFromDB.map((bu: any) => bu.name);
    } else if (businessUnit) {
      const canonical = await resolveUserDirectoryBusinessUnit(req, undefined);
      buNames = [canonical || businessUnit];
    } else {
      return res.json({ stats: [] });
    }

    const stats = await Promise.all(
      buNames.map(async (bu: string) => {
        const [userCount, adminCount, policyCount, conversationCount] = await Promise.all([
          User.countDocuments({ businessUnit: bu }),
          AdminUser.countDocuments({ businessUnit: bu }),
          RagDocument.countDocuments({ businessUnit: bu, processingStatus: { $ne: "superseded" } }),
          Conversation.countDocuments({ businessUnit: bu }),
        ]);
        return { name: bu, users: userCount, admins: adminCount, policies: policyCount, conversations: conversationCount };
      })
    );

    res.json({ stats });
  } catch (error) {
    console.error("BU stats error:", error);
    res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

analyticsRouter.get("/popular-policies", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const limit = parseInt(req.query.limit as string) || 10;
    const filter = isSuperAdmin ? {} : { businessUnit };

    const policies = await Policy.find(filter, { title: 1, category: 1, businessUnit: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ policies });
  } catch (error) {
    console.error("Popular policies error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.get("/chat-activity", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const { startDate, endDate, bu, user } = req.query;

    const query: Record<string, any> = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    } else {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query.createdAt = { $gte: sevenDaysAgo };
    }

    if (isSuperAdmin) {
      if (bu) query.businessUnit = bu;
    } else {
      query.businessUnit = businessUnit;
    }

    if (user) {
      query.userId = user;
    }

    const dailyActivity = await Conversation.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ dailyActivity });
  } catch (error) {
    console.error("Chat activity error:", error);
    res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

analyticsRouter.get("/top-users", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const { limit = 5 } = req.query;

    const filter = isSuperAdmin ? {} : { businessUnit };

    const topUsers = await Conversation.aggregate([
      { $match: filter },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails"
        }
      },
      { $unwind: "$userDetails" },
      {
        $project: {
          name: "$userDetails.fullName",
          email: "$userDetails.email",
          conversations: "$count"
        }
      }
    ]);

    res.json({ topUsers });
  } catch (error) {
    console.error("Top users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.get("/audit-activity", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const { AuditLog } = await import("../models/AuditLog");

    const filter = isSuperAdmin ? {} : { businessUnit };
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);


    const stats = await AuditLog.aggregate([
      { 
        $match: { 
          ...filter,
          createdAt: { $gte: sevenDaysAgo }
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const formattedStats = stats.map(s => {
      const date = new Date(s._id);
      return {
        day: days[date.getDay()],
        count: s.count,
        date: s._id
      };
    });

    res.json({ auditActivity: formattedStats });
  } catch (error) {
    console.error("Audit activity error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Where answers actually came from: your documents, the open web, or neither.
 *
 * Needs no new instrumentation. Every assistant message already stores the sources it
 * cited, and web citations are tagged `documentType: "web"` while knowledge base ones
 * keep their real type, so each answer can be classified after the fact:
 *
 *   knowledgeBase — cited your documents only
 *   web           — cited the open web only
 *   both          — drew on your documents and the web together
 *   model         — cited nothing, so it came from the model's general knowledge
 *
 * The last bucket is the one worth watching. A high share means people are asking things
 * your knowledge base has nothing to say about, and the answers, while probably fine, are
 * not grounded in anything the organisation has approved.
 */
analyticsRouter.get("/answer-sources", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const { Conversation } = await import("../models/Conversation");

    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 180);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await Conversation.aggregate([
      { $match: isSuperAdmin ? {} : { businessUnit } },
      { $unwind: "$conversationGroups" },
      // Drop whole conversations that have not been touched in the window before
      // unwinding their messages, so the pipeline never expands stale history.
      { $match: { "conversationGroups.updatedAt": { $gte: since } } },
      { $unwind: "$conversationGroups.messages" },
      {
        $match: {
          "conversationGroups.messages.role": "assistant",
          "conversationGroups.messages.timestamp": { $gte: since }
        }
      },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$conversationGroups.messages.timestamp" } },
          types: {
            $ifNull: [
              {
                $map: {
                  input: { $ifNull: ["$conversationGroups.messages.sources", []] },
                  as: "s",
                  in: "$$s.documentType"
                }
              },
              []
            ]
          }
        }
      },
      {
        $project: {
          day: 1,
          hasWeb: { $in: ["web", "$types"] },
          hasKb: {
            $gt: [
              { $size: { $filter: { input: "$types", as: "t", cond: { $ne: ["$$t", "web"] } } } },
              0
            ]
          }
        }
      },
      {
        $project: {
          day: 1,
          bucket: {
            $switch: {
              branches: [
                { case: { $and: ["$hasKb", "$hasWeb"] }, then: "both" },
                { case: "$hasKb", then: "knowledgeBase" },
                { case: "$hasWeb", then: "web" }
              ],
              default: "model"
            }
          }
        }
      },
      { $group: { _id: { day: "$day", bucket: "$bucket" }, count: { $sum: 1 } } },
      { $sort: { "_id.day": 1 } }
    ]);

    const totals = { knowledgeBase: 0, web: 0, both: 0, model: 0 };
    const byDay = new Map<string, { date: string; knowledgeBase: number; web: number; both: number; model: number }>();

    for (const row of rows as { _id: { day: string; bucket: keyof typeof totals }; count: number }[]) {
      const { day, bucket } = row._id;
      totals[bucket] += row.count;
      if (!byDay.has(day)) byDay.set(day, { date: day, knowledgeBase: 0, web: 0, both: 0, model: 0 });
      byDay.get(day)![bucket] += row.count;
    }

    const totalAnswers = totals.knowledgeBase + totals.web + totals.both + totals.model;
    const pct = (n: number) => (totalAnswers > 0 ? Number(((n / totalAnswers) * 100).toFixed(1)) : null);

    res.json({
      days,
      totalAnswers,
      totals,
      // "Grounded" counts anything citing your own documents, whether or not it also
      // used the web. It is the number that answers "is the knowledge base earning its keep".
      groundedRate: pct(totals.knowledgeBase + totals.both),
      percentages: {
        knowledgeBase: pct(totals.knowledgeBase),
        web: pct(totals.web),
        both: pct(totals.both),
        model: pct(totals.model)
      },
      daily: Array.from(byDay.values())
    });
  } catch (error) {
    console.error("Answer sources error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Knowledge gaps — where Nexa is failing its users, rather than how busy it is.
 *
 * Three failures that were already being written to the audit log and never read:
 *
 *   • an answer nobody could get, because retrieval came back empty
 *   • an answer somebody was refused, because their groups did not grant access
 *   • a document that never became searchable, because processing failed
 *
 * The first is the useful one: it is literally a queue of what to upload next, in the
 * users' own words. The third matters because it is silent — an admin uploads a policy,
 * sees it listed, and never learns it failed to index.
 *
 * `?days=` widens the window (default 30, capped at 180 so the aggregate stays bounded).
 */
analyticsRouter.get("/knowledge-gaps", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const { AuditLog } = await import("../models/AuditLog");

    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 180);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const scope = isSuperAdmin ? {} : { businessUnit };
    const window = { ...scope, createdAt: { $gte: since } };

    const [counts, dailyMisses, recentMisses, failedDocs] = await Promise.all([
      // One pass for all three totals rather than three round trips.
      AuditLog.aggregate([
        {
          $match: {
            ...window,
            eventType: { $in: ["rag_retrieval_empty", "rag_access_denied", "document_processing_failed", "rag_query"] }
          }
        },
        { $group: { _id: "$eventType", count: { $sum: 1 } } }
      ]),

      AuditLog.aggregate([
        { $match: { ...window, eventType: "rag_retrieval_empty" } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      // Group identical questions so one person asking five times does not crowd out
      // five people asking once. The busiest gaps are the ones worth fixing first.
      AuditLog.aggregate([
        { $match: { ...window, eventType: "rag_retrieval_empty", "metadata.query": { $exists: true, $ne: "" } } },
        {
          $group: {
            _id: { $toLower: "$metadata.query" },
            query: { $first: "$metadata.query" },
            businessUnit: { $first: "$businessUnit" },
            count: { $sum: 1 },
            lastAskedAt: { $max: "$createdAt" }
          }
        },
        { $sort: { count: -1, lastAskedAt: -1 } },
        { $limit: 25 },
        { $project: { _id: 0, query: 1, businessUnit: 1, count: 1, lastAskedAt: 1 } }
      ]),

      AuditLog.find({ ...window, eventType: "document_processing_failed" })
        .sort({ createdAt: -1 })
        .limit(25)
        .select("details businessUnit createdAt metadata")
        .lean()
    ]);

    const countOf = (type: string) => counts.find((c: { _id: string }) => c._id === type)?.count || 0;
    const totalQueries = countOf("rag_query");
    const emptyRetrievals = countOf("rag_retrieval_empty");

    res.json({
      days,
      emptyRetrievals,
      accessDenied: countOf("rag_access_denied"),
      failedDocuments: countOf("document_processing_failed"),
      totalQueries,
      // Share of questions the knowledge base could not answer at all. Null rather than
      // zero when nothing was asked, so the UI shows "no data" instead of a flattering 0%.
      missRate: totalQueries > 0 ? Number(((emptyRetrievals / totalQueries) * 100).toFixed(1)) : null,
      dailyMisses: dailyMisses.map((d: { _id: string; count: number }) => ({ date: d._id, count: d.count })),
      topUnanswered: recentMisses,
      failedDocuments_list: failedDocs.map((d: any) => ({
        details: d.details || "",
        businessUnit: d.businessUnit,
        filename: d.metadata?.filename || "",
        createdAt: d.createdAt
      }))
    });
  } catch (error) {
    console.error("Knowledge gaps error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Platform utilization per business unit, for cost apportionment.
 *
 * `?from=`/`?to=` accept ISO dates; `?format=csv` returns a downloadable file
 * rather than JSON. Reports activity (conversations, messages, assistant replies,
 * active users) — token/cost data is not persisted historically, so use
 * `shareOfLlmCalls` to apportion the provider invoice.
 */
analyticsRouter.get("/utilization-by-bu", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parse = (v: unknown): Date | undefined => {
      if (typeof v !== "string" || !v) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };

    const from = parse(req.query.from);
    const to = parse(req.query.to);

    if (req.query.from && !from) return res.status(400).json({ error: "Invalid 'from' date" });
    if (req.query.to && !to) return res.status(400).json({ error: "Invalid 'to' date" });

    const [rows, unattributedLlmCalls] = await Promise.all([
      buildUtilizationByBu(Conversation, { from, to }),
      countUnattributedLlmCalls(Conversation, { from, to }),
    ]);

    if (req.query.format === "csv") {
      const escape = (v: string | number) => {
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [
        "Business Unit,Active Users,Conversations,Total Messages,Assistant Replies (LLM calls),Share of LLM Calls (%)",
        ...rows.map((r) =>
          [r.businessUnit, r.activeUsers, r.conversations, r.messages, r.assistantMessages, r.shareOfLlmCalls]
            .map(escape)
            .join(",")
        ),
      ].join("\n");

      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="nexa-utilization-${stamp}.csv"`);
      return res.send(csv);
    }

    return res.json({
      range: { from: from ?? null, to: to ?? null },
      totalLlmCalls: rows.reduce((n, r) => n + r.assistantMessages, 0),
      /** Calls from deleted users, excluded from `rows` — surfaced so the gap is visible. */
      unattributedLlmCalls,
      basis: "activity",
      note: "Token and cost data is not captured historically. Apportion provider spend using shareOfLlmCalls.",
      rows,
    });
  } catch (error) {
    logger.error("[Analytics] utilization-by-bu failed", { error: (error as Error).message });
    return res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.get("/usage-by-bu", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const busFromDB = await BusinessUnit.find().select("name").lean();
    const buNames = busFromDB.map((bu: any) => bu.name);

    const usageData = await Promise.all(
      buNames.map(async (bu: string) => {
        const users = await User.countDocuments({ businessUnit: bu });
        return { bu, users };
      })
    );

    res.json({ usageData });
  } catch (error) {
    console.error("Usage by BU error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.post("/reset-password", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ error: "userId and newPassword are required" });
    }
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const user = await User.findByIdAndUpdate(
      userId,
      { password: hashedPassword, $inc: { tokenVersion: 1 } },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Password reset successfully", user });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.get("/business-units-list", adminAuthMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const buses = await BusinessUnit.find({ isActive: { $ne: false } }).select("name label").sort("name");
    const businessUnits = buses.map((bu: any) => ({
      name: bu.name,
      label: bu.label,
      _id: bu._id
    }));
    res.json({ businessUnits });
  } catch (error) {
    console.error("Get BU list error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.post("/business-units", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, label, contactEmail } = req.body;

    if (!name || !label) {
      return res.status(400).json({ error: "Name and label are required" });
    }

    const existingBU = await BusinessUnit.findOne({ name });
    if (existingBU) {
      return res.status(409).json({ error: "Business unit already exists" });
    }

    const newBU = new BusinessUnit({ name, label, ...(contactEmail && { contactEmail }) });
    await newBU.save();

    res.status(201).json({ message: "Business unit created", businessUnit: newBU });
  } catch (error: any) {
    console.error("Add BU error:", error);
    if (error.code === 11000) {
      return res.status(409).json({ error: "Business unit name already exists" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.put("/business-units/:id", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, label } = req.body;

    if (!name || !label) {
      return res.status(400).json({ error: "Name and label are required" });
    }

    const existingBU = await BusinessUnit.findOne({ name, _id: { $ne: id } });
    if (existingBU) {
      return res.status(409).json({ error: "Business unit name already exists" });
    }

    const { isActive, contactEmail } = req.body;
    const updated = await BusinessUnit.findByIdAndUpdate(
      id,
      { name, label, ...(isActive !== undefined && { isActive }), ...(contactEmail !== undefined && { contactEmail }) },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ error: "Business unit not found" });
    }

    res.json({ message: "Business unit updated", businessUnit: updated });
  } catch (error) {
    console.error("Update BU error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.delete("/business-units/:id", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [adminCount, userCount] = await Promise.all([
      AdminUser.countDocuments({ businessUnit: id }),
      User.countDocuments({ businessUnit: id }),
    ]);

    if (adminCount > 0 || userCount > 0) {
      return res.status(400).json({
        error: "Cannot delete business unit with assigned users or admins",
        details: { admins: adminCount, users: userCount }
      });
    }

    const deleted = await BusinessUnit.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Business unit not found" });
    }

    res.json({ message: "Business unit deleted", businessUnit: deleted });
  } catch (error) {
    console.error("Delete BU error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.get("/email-domains", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const domains = await BusinessUnitEmailMapping.find().sort({ businessUnit: 1 });
    res.json({ domains });
  } catch (error) {
    console.error("Error fetching email domains:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.post("/email-domain", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, emailDomain } = req.body;

    if (!businessUnit || !emailDomain) {
      return res.status(400).json({ error: "Business unit and email domain are required" });
    }

    const buExists = await BusinessUnit.findOne({ name: businessUnit });
    if (!buExists) {
      return res.status(400).json({ error: "Business unit does not exist" });
    }

    const mapping = await BusinessUnitEmailMapping.findOneAndUpdate(
      { businessUnit },
      { businessUnit, emailDomain: emailDomain.toLowerCase() },
      { upsert: true, new: true }
    );

    res.json({ message: "Email domain mapping saved successfully", domain: mapping });
  } catch (error) {
    console.error("Error saving email domain:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

analyticsRouter.delete("/email-domain/:id", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const deleted = await BusinessUnitEmailMapping.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Email domain mapping not found" });
    }

    res.json({ message: "Email domain mapping deleted successfully" });
  } catch (error) {
    console.error("Error deleting email domain:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
