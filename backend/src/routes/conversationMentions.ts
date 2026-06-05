import express, { Response } from "express";
import mongoose from "mongoose";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { ConversationMention } from "../models/ConversationMention";
import { ConversationCollaboration } from "../models/ConversationCollaboration";
import { Conversation } from "../models/Conversation";
import { User } from "../models/User";
import { sendConversationMentionEmail } from "../services/emailService";

export const conversationMentionsRouter = express.Router();

const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

/** GET /api/v1/conversations/mentionable-users */
conversationMentionsRouter.get(
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

/** GET /api/v1/conversations/mentioned-in-me */
conversationMentionsRouter.get(
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

/** POST /api/v1/conversations/:id/mention */
conversationMentionsRouter.post(
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

      const existing = await ConversationMention.findOne({
        mentionedUserId: new mongoose.Types.ObjectId(mentionedUserId),
        originalGroupId: conversationGroupId,
      });
      if (existing) return res.status(409).json({ error: "Already mentioned in this conversation" });

      let mentionedConvs = await Conversation.findOne({ userId: new mongoose.Types.ObjectId(mentionedUserId) });
      if (!mentionedConvs) {
        mentionedConvs = new Conversation({
          userId: new mongoose.Types.ObjectId(mentionedUserId),
          businessUnit: mentioned.businessUnit,
          conversationGroups: [],
        });
      }
      mentionedConvs.conversationGroups.push({ title: group.title, messages: group.messages, createdAt: new Date(), updatedAt: new Date() } as any);
      await mentionedConvs.save();

      const forkedGroup = mentionedConvs.conversationGroups[mentionedConvs.conversationGroups.length - 1];

      // Create bidirectional collaboration record so messages sync both ways
      await ConversationCollaboration.create({
        ownerId: new mongoose.Types.ObjectId(req.userId!),
        ownerGroupId: conversationGroupId,
        collaboratorId: new mongoose.Types.ObjectId(mentionedUserId),
        collaboratorGroupId: forkedGroup._id.toString(),
        businessUnit: req.businessUnit || "",
      });

      await ConversationMention.create({
        mentionerId: new mongoose.Types.ObjectId(req.userId!),
        mentionedUserId: new mongoose.Types.ObjectId(mentionedUserId),
        originalConvDocId: ownerConvs!._id,
        originalGroupId: conversationGroupId,
        forkedGroupId: forkedGroup._id.toString(),
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
      console.error("[mention]", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);
