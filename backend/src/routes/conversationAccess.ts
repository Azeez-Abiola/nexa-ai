import express, { Request, Response } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { ConversationAccessRequest } from "../models/ConversationAccessRequest";
import { Conversation } from "../models/Conversation";
import { User } from "../models/User";
import {
  sendConversationAccessRequestEmail,
  sendAccessRequestAcceptedEmail,
  sendAccessRequestDeclinedEmail,
} from "../services/emailService";

export const conversationAccessRouter = express.Router();

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

/** POST /api/v1/conversations/access-request */
conversationAccessRouter.post(
  "/access-request",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { conversationGroupId, sharerId } = req.body;
      if (!conversationGroupId || !sharerId) {
        return res.status(400).json({ error: "conversationGroupId and sharerId are required" });
      }
      if (!mongoose.Types.ObjectId.isValid(conversationGroupId) || !mongoose.Types.ObjectId.isValid(sharerId)) {
        return res.status(400).json({ error: "Invalid IDs" });
      }

      const existing = await ConversationAccessRequest.findOne({
        conversationGroupId: new mongoose.Types.ObjectId(conversationGroupId),
        requesterId: new mongoose.Types.ObjectId(req.userId!),
        status: "pending",
      });
      if (existing) return res.status(409).json({ error: "You already have a pending request for this conversation." });

      const [requester, sharer, ownerConvs] = await Promise.all([
        User.findById(req.userId).select("fullName email").lean(),
        User.findById(sharerId).select("fullName email").lean(),
        Conversation.findOne({ userId: new mongoose.Types.ObjectId(sharerId) }).lean(),
      ]);

      if (!requester || !sharer) return res.status(404).json({ error: "User not found" });

      const group = ownerConvs?.conversationGroups.find(g => g._id.toString() === conversationGroupId);
      const conversationTitle = group?.title || "Untitled conversation";

      const acceptToken = crypto.randomBytes(24).toString("hex");
      const rejectToken = crypto.randomBytes(24).toString("hex");

      await ConversationAccessRequest.create({
        conversationGroupId: new mongoose.Types.ObjectId(conversationGroupId),
        requesterId: new mongoose.Types.ObjectId(req.userId!),
        sharerId: new mongoose.Types.ObjectId(sharerId),
        businessUnit: req.businessUnit || "",
        conversationTitle,
        requesterName: requester.fullName || requester.email,
        requesterEmail: requester.email,
        sharerName: sharer.fullName || sharer.email,
        sharerEmail: sharer.email,
        acceptToken,
        rejectToken,
      });

      await sendConversationAccessRequestEmail({
        sharerEmail: sharer.email,
        sharerName: sharer.fullName || sharer.email,
        requesterName: requester.fullName || requester.email,
        requesterEmail: requester.email,
        conversationTitle,
        businessUnit: req.businessUnit || "",
        acceptUrl: `${FRONTEND_URL}/access-request/respond?token=${acceptToken}&action=accept`,
        rejectUrl: `${FRONTEND_URL}/access-request/respond?token=${rejectToken}&action=reject`,
      });

      return res.status(201).json({ message: "Access request sent" });
    } catch (err) {
      console.error("[access-request]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/** GET /api/v1/conversations/access-request/respond?token=&action= — opened from email */
conversationAccessRouter.get(
  "/access-request/respond",
  async (req: Request, res: Response) => {
    const { token, action } = req.query as { token?: string; action?: string };

    const page = (title: string, body: string, color = "#16a34a") =>
      res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f0f0}.card{background:#fff;border-radius:12px;padding:40px 48px;box-shadow:0 4px 20px rgba(0,0,0,.1);text-align:center;max-width:480px}h2{color:${color};margin:0 0 12px}p{color:#555;margin:0}</style></head><body><div class="card"><h2>${title}</h2><p>${body}</p></div></body></html>`);

    if (!token || !["accept", "reject"].includes(action || "")) {
      return page("Invalid link", "This link is invalid or has already been used.", "#dc2626");
    }

    try {
      const field = action === "accept" ? "acceptToken" : "rejectToken";
      const ar = await ConversationAccessRequest.findOne({ [field]: token });
      if (!ar) return page("Already used", "This link has already been used or expired.", "#6b7280");
      if (ar.status !== "pending") {
        return page(
          ar.status === "accepted" ? "Already accepted" : "Already declined",
          "This request has already been processed.", "#6b7280"
        );
      }

      if (action === "reject") {
        ar.status = "rejected";
        await ar.save();
        sendAccessRequestDeclinedEmail({
          requesterEmail: ar.requesterEmail,
          requesterName: ar.requesterName,
          sharerName: ar.sharerName,
          conversationTitle: ar.conversationTitle,
        });
        return page("Request declined", `You have declined ${ar.requesterName}'s request.`, "#dc2626");
      }

      ar.status = "accepted";
      await ar.save();

      const ownerConvs = await Conversation.findOne({ userId: ar.sharerId });
      const group = ownerConvs?.conversationGroups.find(g => g._id.toString() === ar.conversationGroupId.toString());

      if (group) {
        let recipientConvs = await Conversation.findOne({ userId: ar.requesterId });
        if (!recipientConvs) {
          recipientConvs = new Conversation({ userId: ar.requesterId, businessUnit: ar.businessUnit, conversationGroups: [] });
        }
        recipientConvs.conversationGroups.push({ title: group.title, messages: group.messages, createdAt: new Date(), updatedAt: new Date() } as any);
        await recipientConvs.save();
      }

      sendAccessRequestAcceptedEmail({
        requesterEmail: ar.requesterEmail,
        requesterName: ar.requesterName,
        sharerName: ar.sharerName,
        conversationTitle: ar.conversationTitle,
        chatUrl: `${FRONTEND_URL}/user-chat`,
      });

      return page("Request accepted!", `${ar.requesterName} can now continue the conversation. You can close this tab.`);
    } catch (err) {
      console.error("[access-request/respond]", err);
      return page("Something went wrong", "Please try again later.", "#dc2626");
    }
  }
);

/** POST /api/v1/conversations/access-request/process — JSON endpoint for frontend */
conversationAccessRouter.post(
  "/access-request/process",
  async (req: Request, res: Response) => {
    const { token, action } = req.body as { token?: string; action?: string };
    if (!token || !["accept", "reject"].includes(action || "")) {
      return res.status(400).json({ error: "Invalid request" });
    }
    try {
      const field = action === "accept" ? "acceptToken" : "rejectToken";
      const ar = await ConversationAccessRequest.findOne({ [field]: token });
      if (!ar) return res.status(404).json({ error: "This link has already been used or expired." });
      if (ar.status !== "pending") return res.status(409).json({ status: ar.status, error: "Already processed" });

      if (action === "reject") {
        ar.status = "rejected";
        await ar.save();
        sendAccessRequestDeclinedEmail({ requesterEmail: ar.requesterEmail, requesterName: ar.requesterName, sharerName: ar.sharerName, conversationTitle: ar.conversationTitle });
        return res.json({ status: "rejected", message: `You declined ${ar.requesterName}'s request.` });
      }

      ar.status = "accepted";
      await ar.save();

      const ownerConvs = await Conversation.findOne({ userId: ar.sharerId });
      const group = ownerConvs?.conversationGroups.find(g => g._id.toString() === ar.conversationGroupId.toString());
      if (group) {
        let recipientConvs = await Conversation.findOne({ userId: ar.requesterId });
        if (!recipientConvs) {
          recipientConvs = new Conversation({ userId: ar.requesterId, businessUnit: ar.businessUnit, conversationGroups: [] });
        }
        recipientConvs.conversationGroups.push({ title: group.title, messages: group.messages, createdAt: new Date(), updatedAt: new Date() } as any);
        await recipientConvs.save();
      }

      sendAccessRequestAcceptedEmail({ requesterEmail: ar.requesterEmail, requesterName: ar.requesterName, sharerName: ar.sharerName, conversationTitle: ar.conversationTitle, chatUrl: `${FRONTEND_URL}/user-chat` });
      return res.json({ status: "accepted", message: `Access granted! ${ar.requesterName} can now continue the conversation.` });
    } catch (err) {
      console.error("[access-request/process]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/** GET /api/v1/conversations/access-request/status/:conversationGroupId — requester polls this */
conversationAccessRouter.get(
  "/access-request/status/:conversationGroupId",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ar = await ConversationAccessRequest.findOne({
        conversationGroupId: new mongoose.Types.ObjectId(req.params.conversationGroupId),
        requesterId: new mongoose.Types.ObjectId(req.userId!),
      }).sort({ createdAt: -1 });
      return res.json({ status: ar?.status || "none" });
    } catch {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);
