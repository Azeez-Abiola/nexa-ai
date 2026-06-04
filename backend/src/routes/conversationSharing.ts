import express, { Response, Request } from "express";
import crypto from "crypto";
import mongoose from "mongoose";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import {
  shareConversation,
  getConversationsSharedWithMe,
  revokeShare,
  createShareLink,
  getConversationByShareLink
} from "../services/sharingService";
import { ConversationAccessRequest } from "../models/ConversationAccessRequest";
import { ConversationMention } from "../models/ConversationMention";
import { Conversation } from "../models/Conversation";
import { User } from "../models/User";
import {
  sendConversationAccessRequestEmail,
  sendAccessRequestAcceptedEmail,
  sendAccessRequestDeclinedEmail,
  sendConversationMentionEmail,
} from "../services/emailService";

export const conversationSharingRouter = express.Router();

/**
 * POST /api/v1/conversations/:id/share
 *
 * Share a conversation group with another user.
 * Body: { recipientEmail: string }
 *
 * Enforces: sender.businessUnit === recipient.businessUnit
 */
conversationSharingRouter.post(
  "/:id/share",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { recipientEmail } = req.body;

    if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.trim()) {
      return res.status(400).json({ error: "recipientEmail is required" });
    }

    const result = await shareConversation(
      req.userId!,
      req.businessUnit!,
      id,
      recipientEmail.trim()
    ).catch(() => ({
      success: false as const,
      status: 500,
      error: "Internal server error"
    }));

    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(201).json({
      message: `Conversation shared successfully with ${result.sharedWithEmail}`,
      shareId: result.shareId,
      sharedWithEmail: result.sharedWithEmail
    });
  }
);

/**
 * POST /api/v1/conversations/:groupId/messages/:idx/share
 *
 * Share a single AI response within a conversation. The recipient sees only that
 * assistant message and the immediately-preceding user question.
 * Body: { recipientEmail: string }
 *
 * Same access rules as whole-conversation share apply (BU match + per-source redaction).
 */
conversationSharingRouter.post(
  "/:groupId/messages/:idx/share",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const { groupId, idx } = req.params;
    const { recipientEmail } = req.body;

    if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.trim()) {
      return res.status(400).json({ error: "recipientEmail is required" });
    }

    const messageIndex = Number.parseInt(idx, 10);
    if (!Number.isInteger(messageIndex) || messageIndex < 0) {
      return res.status(400).json({ error: "Invalid message index" });
    }

    const result = await shareConversation(
      req.userId!,
      req.businessUnit!,
      groupId,
      recipientEmail.trim(),
      messageIndex
    ).catch(() => ({
      success: false as const,
      status: 500,
      error: "Internal server error"
    }));

    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(201).json({
      message: `AI response shared successfully with ${result.sharedWithEmail}`,
      shareId: result.shareId,
      sharedWithEmail: result.sharedWithEmail
    });
  }
);

/**
 * GET /api/v1/conversations/shared-with-me
 *
 * Returns all conversations that have been shared with the authenticated user.
 */
conversationSharingRouter.get(
  "/shared-with-me",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const shared = await getConversationsSharedWithMe(req.userId!);
      return res.json({ sharedConversations: shared });
    } catch (error) {
      console.error("Get shared conversations error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * DELETE /api/v1/conversations/shared/:shareId
 *
 * Revoke a share. Only the original sharer can revoke.
 */
conversationSharingRouter.delete(
  "/shared/:shareId",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const { shareId } = req.params;

    const result = await revokeShare(shareId, req.userId!).catch(() => ({
      success: false as const,
      status: 500,
      error: "Internal server error"
    }));

    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ message: "Share revoked successfully" });
  }
);

/**
 * POST /api/v1/conversations/:groupId/share-link
 *
 * Generate (or return existing) a tokenised share link for a whole conversation.
 * Body: { messageIndex?: number } — set to scope to a single AI response.
 * Response: { token, shareUrl }
 */
conversationSharingRouter.post(
  "/:groupId/share-link",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const { groupId } = req.params;
    const { messageIndex } = (req.body || {}) as { messageIndex?: number };

    const result = await createShareLink(
      req.userId!,
      req.businessUnit!,
      groupId,
      messageIndex
    ).catch(() => ({ success: false as const, status: 500, error: "Internal server error" }));

    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }

    // The frontend will compose the user-visible URL. We just hand back the token.
    return res.status(201).json({ token: result.token });
  }
);

/**
 * GET /api/v1/conversations/share-link/:token
 *
 * Resolve a share-link token. Authenticated user must be in the same business
 * unit as the original sharer; per-source redaction is applied based on the
 * viewer's group memberships.
 */
conversationSharingRouter.get(
  "/share-link/:token",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const { token } = req.params;
    const result = await getConversationByShareLink(token, req.userId!).catch(() => ({
      success: false as const,
      status: 500,
      error: "Internal server error"
    }));
    if (!result.success) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result);
  }
);

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const BACKEND_URL = (process.env.BACKEND_URL || FRONTEND_URL).replace(/\/$/, "");

/**
 * GET /api/v1/conversations/mentionable-users
 * Returns active users in the caller's BU (excluding self) for the @mention dropdown.
 */
conversationSharingRouter.get(
  "/mentionable-users",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await User.find({
        businessUnit: req.businessUnit,
        isActive: { $ne: false },
        _id: { $ne: new mongoose.Types.ObjectId(req.userId!) },
      })
        .select("_id fullName email")
        .sort({ fullName: 1 })
        .lean();
      return res.json({ users });
    } catch {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/v1/conversations/:id/mention
 * Mention (tag) a user in a conversation — forks the conversation for them and sends email.
 */
conversationSharingRouter.post(
  "/:id/mention",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { mentionedUserId } = req.body;
      const { id: conversationGroupId } = req.params;
      if (!mentionedUserId || !mongoose.Types.ObjectId.isValid(mentionedUserId)) {
        return res.status(400).json({ error: "mentionedUserId is required" });
      }
      if (mentionedUserId === req.userId) {
        return res.status(400).json({ error: "You cannot mention yourself" });
      }

      const [mentioner, mentioned, ownerConvs] = await Promise.all([
        User.findById(req.userId).select("fullName email").lean(),
        User.findById(mentionedUserId).select("fullName email businessUnit").lean(),
        Conversation.findOne({ userId: new mongoose.Types.ObjectId(req.userId!) }),
      ]);

      if (!mentioner || !mentioned) return res.status(404).json({ error: "User not found" });
      if (mentioned.businessUnit !== req.businessUnit) {
        return res.status(403).json({ error: "Can only mention users in the same business unit" });
      }

      const group = ownerConvs?.conversationGroups.find(g => g._id.toString() === conversationGroupId);
      if (!group) return res.status(404).json({ error: "Conversation not found" });

      // Check for duplicate mention
      const existing = await ConversationMention.findOne({
        mentionedUserId: new mongoose.Types.ObjectId(mentionedUserId),
        originalGroupId: conversationGroupId,
      });
      if (existing) return res.status(409).json({ error: "Already mentioned in this conversation" });

      // Fork the conversation into the mentioned user's history
      let mentionedConvs = await Conversation.findOne({ userId: new mongoose.Types.ObjectId(mentionedUserId) });
      if (!mentionedConvs) {
        mentionedConvs = new Conversation({
          userId: new mongoose.Types.ObjectId(mentionedUserId),
          businessUnit: mentioned.businessUnit,
          conversationGroups: [],
        });
      }
      const forkedGroup = {
        title: group.title,
        messages: group.messages,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mentionedConvs.conversationGroups.push(forkedGroup as any);
      await mentionedConvs.save();

      const savedForkedGroup = mentionedConvs.conversationGroups[mentionedConvs.conversationGroups.length - 1];

      await ConversationMention.create({
        mentionerId: new mongoose.Types.ObjectId(req.userId!),
        mentionedUserId: new mongoose.Types.ObjectId(mentionedUserId),
        originalConvDocId: ownerConvs!._id,
        originalGroupId: conversationGroupId,
        forkedGroupId: savedForkedGroup._id.toString(),
        businessUnit: req.businessUnit || "",
        mentionerName: mentioner.fullName || mentioner.email,
        conversationTitle: group.title,
      });

      sendConversationMentionEmail({
        mentionedEmail: mentioned.email,
        mentionedName: mentioned.fullName || mentioned.email,
        mentionerName: mentioner.fullName || mentioner.email,
        conversationTitle: group.title,
        chatUrl: `${FRONTEND_URL}/user-chat`,
      });

      return res.status(201).json({ message: `${mentioned.fullName || mentioned.email} has been mentioned` });
    } catch (err) {
      console.error("[mention] error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /api/v1/conversations/mentioned-in-me
 * Returns forked conversations where the current user was @mentioned.
 */
conversationSharingRouter.get(
  "/mentioned-in-me",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mentions = await ConversationMention.find({
        mentionedUserId: new mongoose.Types.ObjectId(req.userId!),
      })
        .sort({ createdAt: -1 })
        .lean();

      if (mentions.length === 0) return res.json({ mentions: [] });

      const myConvs = await Conversation.findOne({ userId: new mongoose.Types.ObjectId(req.userId!) }).lean();

      const result = mentions.map(m => {
        const group = myConvs?.conversationGroups.find(g => g._id.toString() === m.forkedGroupId);
        if (!group) return null;
        return {
          mentionId: m._id,
          mentionerName: m.mentionerName,
          conversationTitle: m.conversationTitle,
          conversation: {
            _id: group._id,
            title: group.title,
            messages: group.messages,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
          },
        };
      }).filter(Boolean);

      return res.json({ mentions: result });
    } catch {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/v1/conversations/access-request
 * Recipient requests to continue a shared read-only conversation.
 */
conversationSharingRouter.post(
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

      // Prevent duplicate pending requests
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
        acceptUrl: `${BACKEND_URL}/api/v1/conversations/access-request/respond?token=${acceptToken}&action=accept`,
        rejectUrl: `${BACKEND_URL}/api/v1/conversations/access-request/respond?token=${rejectToken}&action=reject`,
      });

      return res.status(201).json({ message: "Access request sent" });
    } catch (err) {
      console.error("[access-request] error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * GET /api/v1/conversations/access-request/respond?token=XXX&action=accept|reject
 * Public endpoint — opened from the email link. No auth required.
 */
conversationSharingRouter.get(
  "/access-request/respond",
  async (req: Request, res: Response) => {
    const { token, action } = req.query as { token?: string; action?: string };

    const respondPage = (title: string, body: string, color = "#16a34a") => res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f0f0f0}.card{background:#fff;border-radius:12px;padding:40px 48px;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;max-width:480px}h2{color:${color};margin:0 0 12px}p{color:#555;margin:0}</style></head><body><div class="card"><h2>${title}</h2><p>${body}</p></div></body></html>`);

    if (!token || !["accept", "reject"].includes(action || "")) {
      return respondPage("Invalid link", "This link is invalid or has already been used.", "#dc2626");
    }

    try {
      const field = action === "accept" ? "acceptToken" : "rejectToken";
      const ar = await ConversationAccessRequest.findOne({ [field]: token });

      if (!ar) return respondPage("Already used", "This link has already been used or has expired.", "#6b7280");
      if (ar.status !== "pending") {
        return respondPage(
          ar.status === "accepted" ? "Already accepted" : "Already declined",
          "This request has already been processed.",
          "#6b7280"
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
        return respondPage("Request declined", `You have declined ${ar.requesterName}'s request.`, "#dc2626");
      }

      // Accept: fork the conversation into the requester's history
      ar.status = "accepted";
      ar.acceptToken = `_used_${ar.acceptToken}`;
      ar.rejectToken = `_used_${ar.rejectToken}`;
      await ar.save();

      // Load the original conversation group
      const ownerConvs = await Conversation.findOne({ userId: ar.sharerId });
      const group = ownerConvs?.conversationGroups.find(g => g._id.toString() === ar.conversationGroupId.toString());

      if (group) {
        let requesterConvs = await Conversation.findOne({ userId: ar.requesterId });
        if (!requesterConvs) {
          requesterConvs = new Conversation({ userId: ar.requesterId, businessUnit: ar.businessUnit, conversationGroups: [] });
        }
        requesterConvs.conversationGroups.push({
          title: group.title,
          messages: group.messages,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
        await requesterConvs.save();
      }

      sendAccessRequestAcceptedEmail({
        requesterEmail: ar.requesterEmail,
        requesterName: ar.requesterName,
        sharerName: ar.sharerName,
        conversationTitle: ar.conversationTitle,
        chatUrl: `${FRONTEND_URL}/user-chat`,
      });

      return respondPage(
        "Request accepted!",
        `${ar.requesterName} can now continue the conversation on Nexa AI. You can close this tab.`
      );
    } catch (err) {
      console.error("[access-request/respond] error:", err);
      return respondPage("Something went wrong", "Please try again later.", "#dc2626");
    }
  }
);
