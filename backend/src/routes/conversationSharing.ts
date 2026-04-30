import express, { Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import {
  shareConversation,
  getConversationsSharedWithMe,
  revokeShare
} from "../services/sharingService";

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
