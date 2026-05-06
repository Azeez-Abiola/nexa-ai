import express, { Response } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { Notification } from "../models/Notification";
import { AuthenticatedRequest } from "../middleware/auth";

export const notificationsRouter = express.Router();

const JWT_SECRET = process.env.NEXA_AI_JWT_SECRET!;

/**
 * Unified middleware: accepts either a user JWT (userId in payload) or an admin JWT
 * (adminId in payload). Notifications belong to either, so we resolve the recipient id
 * from whatever's in the token.
 */
function eitherAuth(req: AuthenticatedRequest, res: Response, next: express.NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Authorization token required" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const id = decoded.adminId || decoded.userId;
    if (!id) return res.status(401).json({ error: "Token has no recipient id" });
    req.userId = decoded.userId;
    req.adminId = decoded.adminId;
    req.email = decoded.email;
    req.businessUnit =
      typeof decoded.businessUnit === "string" ? decoded.businessUnit.trim() : decoded.businessUnit;
    req.isAdmin = !!decoded.isAdmin;
    req.isSuperAdmin = (decoded.businessUnit || "").trim() === "SUPERADMIN";
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Active recipient id for the current request — admin or user, whichever the JWT carried. */
function recipientIdFor(req: AuthenticatedRequest): string | null {
  return req.adminId || req.userId || null;
}

// GET /api/v1/notifications?limit=&unreadOnly=
notificationsRouter.get("/", eitherAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipientId = recipientIdFor(req);
    if (!recipientId) return res.status(401).json({ error: "Authenticated id missing" });
    const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, 100);
    const unreadOnly = req.query.unreadOnly === "true";
    const filter: Record<string, unknown> = { recipientId: new mongoose.Types.ObjectId(recipientId) };
    if (unreadOnly) filter.read = false;
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    const unreadCount = await Notification.countDocuments({
      recipientId: new mongoose.Types.ObjectId(recipientId),
      read: false
    });
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("List notifications error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/v1/notifications/unread-count
notificationsRouter.get("/unread-count", eitherAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipientId = recipientIdFor(req);
    if (!recipientId) return res.status(401).json({ error: "Authenticated id missing" });
    const unreadCount = await Notification.countDocuments({
      recipientId: new mongoose.Types.ObjectId(recipientId),
      read: false
    });
    res.json({ unreadCount });
  } catch (error) {
    console.error("Unread count error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/v1/notifications/:id/read
notificationsRouter.patch("/:id/read", eitherAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipientId = recipientIdFor(req);
    if (!recipientId) return res.status(401).json({ error: "Authenticated id missing" });
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid notification id" });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: new mongoose.Types.ObjectId(recipientId) },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    res.json({ notification });
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/v1/notifications/read-all
notificationsRouter.patch("/read-all", eitherAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipientId = recipientIdFor(req);
    if (!recipientId) return res.status(401).json({ error: "Authenticated id missing" });
    const result = await Notification.updateMany(
      { recipientId: new mongoose.Types.ObjectId(recipientId), read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
