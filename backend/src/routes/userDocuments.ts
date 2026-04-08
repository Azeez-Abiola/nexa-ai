import express, { Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { UserDocument } from "../models/UserDocument";
import { UserDocumentChunk } from "../models/UserDocumentChunk";
import { deleteDocument } from "../services/cloudinaryService";
import logger from "../utils/logger";

/**
 * Mounted under /api/v1/conversations by index.ts.
 * Provides document management endpoints scoped to a chat session.
 *
 * GET  /api/v1/conversations/:id/documents         — list session documents
 * DELETE /api/v1/conversations/:id/documents/:docId — delete document + chunks
 */
export const userDocumentsRouter = express.Router();

// ─── List session documents ───────────────────────────────────────────────────
userDocumentsRouter.get(
  "/:id/documents",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: chatSessionId } = req.params;
      const userId = req.userId!;

      const documents = await UserDocument.find(
        { userId, chatSessionId },
        { cloudinaryPublicId: 0 } // never expose internal storage key
      )
        .sort({ createdAt: -1 })
        .lean();

      logger.info("[UserDocuments] Listed session documents", {
        userId,
        chatSessionId,
        count: documents.length
      });

      res.json({ documents });
    } catch (err) {
      logger.error("[UserDocuments] List error", { error: (err as Error).message });
      res.status(500).json({ error: "Failed to list documents" });
    }
  }
);

// ─── Delete a session document ────────────────────────────────────────────────
userDocumentsRouter.delete(
  "/:id/documents/:docId",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: chatSessionId, docId } = req.params;
      const userId = req.userId!;

      // Verify ownership — user can only delete their own session documents
      const doc = await UserDocument.findOne({ _id: docId, userId, chatSessionId });
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Remove from Cloudinary (best-effort)
      try {
        await deleteDocument(doc.cloudinaryPublicId);
      } catch (cloudinaryErr) {
        logger.warn("[UserDocuments] Cloudinary delete failed (continuing)", {
          docId,
          error: (cloudinaryErr as Error).message
        });
      }

      // Delete chunks and document record
      const [chunksResult] = await Promise.all([
        UserDocumentChunk.deleteMany({ documentId: docId }),
        UserDocument.deleteOne({ _id: docId })
      ]);

      logger.info("[UserDocuments] Document deleted", {
        docId,
        userId,
        chatSessionId,
        chunksDeleted: chunksResult.deletedCount
      });

      res.json({ success: true });
    } catch (err) {
      logger.error("[UserDocuments] Delete error", { error: (err as Error).message });
      res.status(500).json({ error: "Failed to delete document" });
    }
  }
);
