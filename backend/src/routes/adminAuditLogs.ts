import express from "express";
import { AuditLog } from "../models/AuditLog";
import { adminAuthMiddleware, AuthenticatedRequest } from "../middleware/auth";
import logger from "../utils/logger";

export const adminAuditLogsRouter = express.Router();

adminAuditLogsRouter.use(adminAuthMiddleware);

adminAuditLogsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const page = parseInt((req.query.page as string) || "1");
    const limit = Math.min(parseInt((req.query.limit as string) || "50"), 200);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = isSuperAdmin ? {} : { businessUnit };

    if (req.query.eventType) filter.eventType = req.query.eventType;
    if (req.query.documentId) filter.documentId = req.query.documentId;

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from as string);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to as string);
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter)
    ]);

    res.json({ logs, total, page, limit });
  } catch (err) {
    console.error("[AuditLogs] CRITICAL ERROR:", err);
    logger.error("[AuditLogs] Query error", { error: (err as Error).message, stack: (err as Error).stack });
    res.status(500).json({ error: "Failed to query audit logs", details: (err as Error).message });
  }
});
