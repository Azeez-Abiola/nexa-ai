import express from "express";
import multer from "multer";
import { RagDocument } from "../models/RagDocument";
import { DocumentChunk } from "../models/DocumentChunk";
import { adminAuthMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { uploadDocument, deleteDocument } from "../services/cloudinaryService";
import { cleanupDocumentChunks } from "../services/documentProcessingService";
import { documentQueue } from "../queue/documentQueue";
import { logDocumentUpload } from "../services/auditService";
import logger from "../utils/logger";

export const adminDocumentsRouter = express.Router();

// multer uses memory storage — buffer is then streamed to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv"
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, TXT, and CSV files are allowed"));
    }
  }
});

adminDocumentsRouter.use(adminAuthMiddleware);

// ─── List documents ────────────────────────────────────────────────────────────
adminDocumentsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const skip = (page - 1) * limit;

    const filter = isSuperAdmin ? {} : { businessUnit };

    const [documents, total] = await Promise.all([
      RagDocument.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-cloudinaryPublicId") // don't expose internal storage key
        .lean(),
      RagDocument.countDocuments(filter)
    ]);

    res.json({ documents, total, page, limit });
  } catch (err) {
    logger.error("[AdminDocuments] List error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to list documents" });
  }
});

// ─── Processing status summary ─────────────────────────────────────────────────
adminDocumentsRouter.get("/status/summary", async (req: AuthenticatedRequest, res) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const match = isSuperAdmin ? {} : { businessUnit };

    const summary = await RagDocument.aggregate([
      { $match: match },
      { $group: { _id: "$processingStatus", count: { $sum: 1 } } }
    ]);

    const result: Record<string, number> = {};
    for (const s of summary) result[s._id] = s.count;

    res.json(result);
  } catch (err) {
    logger.error("[AdminDocuments] Status summary error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to get status summary" });
  }
});

// ─── Get single document ───────────────────────────────────────────────────────
adminDocumentsRouter.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { businessUnit, isSuperAdmin } = req;

    const doc = await RagDocument.findById(id).select("-cloudinaryPublicId").lean();
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isSuperAdmin && doc.businessUnit !== businessUnit) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ document: doc });
  } catch (err) {
    logger.error("[AdminDocuments] Get error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to get document" });
  }
});

// ─── Upload new document ───────────────────────────────────────────────────────
adminDocumentsRouter.post("/", upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, documentType, sensitivityLevel, allowedGrades } = req.body;
    const file = req.file;
    const { businessUnit: tokenBU, adminId, email: adminEmail, fullName: adminName, isSuperAdmin } = req;

    if (!file) return res.status(400).json({ error: "File is required" });
    if (!title) return res.status(400).json({ error: "title is required" });
    if (!documentType) return res.status(400).json({ error: "documentType is required" });
    if (!sensitivityLevel) return res.status(400).json({ error: "sensitivityLevel is required" });

    const targetBU = isSuperAdmin ? (req.body.businessUnit || tokenBU) : tokenBU;
    if (isSuperAdmin && !req.body.businessUnit) {
      return res.status(400).json({ error: "SUPERADMIN must specify a businessUnit" });
    }

    const parsedGrades = Array.isArray(allowedGrades)
      ? allowedGrades
      : typeof allowedGrades === "string" && allowedGrades.trim()
      ? allowedGrades.split(",").map((g: string) => g.trim()).filter(Boolean)
      : [];

    // Upload to Cloudinary
    const { publicId, secureUrl } = await uploadDocument(
      file.buffer,
      file.originalname,
      targetBU!,
      file.mimetype
    );

    // Create RagDocument record
    const doc = await RagDocument.create({
      title,
      businessUnit: targetBU,
      documentType,
      sensitivityLevel,
      allowedGrades: parsedGrades,
      uploadedBy: {
        adminId: adminId || "unknown",
        adminEmail: adminEmail || "unknown",
        adminName: adminName || "Unknown"
      },
      cloudinaryPublicId: publicId,
      cloudinaryUrl: secureUrl,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      processingStatus: "pending"
    });

    // Enqueue processing job
    const job = await documentQueue.add(
      "process-document",
      {
        documentId: doc._id.toString(),
        cloudinaryPublicId: publicId,
        cloudinaryUrl: secureUrl,
        mimeType: file.mimetype,
        businessUnit: targetBU!,
        allowedGrades: parsedGrades,
        sensitivityLevel,
        uploadedBy: {
          adminId: adminId || "unknown",
          adminEmail: adminEmail || "unknown",
          adminName: adminName || "Unknown"
        }
      },
      { jobId: `doc-${doc._id}` }
    );

    await RagDocument.findByIdAndUpdate(doc._id, { processingJobId: job.id });

    logDocumentUpload(adminId || "unknown", targetBU!, doc._id.toString(), {
      filename: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      cloudinaryPublicId: publicId
    });

    logger.info("[AdminDocuments] Document uploaded and queued", {
      documentId: doc._id,
      jobId: job.id,
      businessUnit: targetBU
    });

    res.status(201).json({
      document: {
        _id: doc._id,
        title: doc.title,
        businessUnit: doc.businessUnit,
        documentType: doc.documentType,
        sensitivityLevel: doc.sensitivityLevel,
        allowedGrades: doc.allowedGrades,
        originalFilename: doc.originalFilename,
        fileSize: doc.fileSize,
        processingStatus: doc.processingStatus,
        processingJobId: job.id,
        createdAt: doc.createdAt
      },
      message: "Document uploaded. Processing started in background."
    });
  } catch (err) {
    logger.error("[AdminDocuments] Upload error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// ─── Reprocess a failed/completed document ────────────────────────────────────
adminDocumentsRouter.post("/:id/reprocess", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { businessUnit, isSuperAdmin } = req;

    const doc = await RagDocument.findById(id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isSuperAdmin && doc.businessUnit !== businessUnit) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Remove old chunks
    await cleanupDocumentChunks(id);

    // Reset status
    await RagDocument.findByIdAndUpdate(id, {
      processingStatus: "pending",
      processingError: null,
      totalChunks: 0,
      embeddedAt: null
    });

    const job = await documentQueue.add(
      "process-document",
      {
        documentId: doc._id.toString(),
        cloudinaryPublicId: doc.cloudinaryPublicId,
        cloudinaryUrl: doc.cloudinaryUrl,
        mimeType: doc.mimeType,
        businessUnit: doc.businessUnit,
        allowedGrades: doc.allowedGrades,
        sensitivityLevel: doc.sensitivityLevel,
        uploadedBy: doc.uploadedBy
      },
      { jobId: `doc-${doc._id}-reprocess-${Date.now()}` }
    );

    await RagDocument.findByIdAndUpdate(id, { processingJobId: job.id });

    logger.info("[AdminDocuments] Reprocessing queued", { documentId: id, jobId: job.id });
    res.json({ message: "Reprocessing started", jobId: job.id });
  } catch (err) {
    logger.error("[AdminDocuments] Reprocess error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to queue reprocessing" });
  }
});

// ─── Delete document ───────────────────────────────────────────────────────────
adminDocumentsRouter.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { businessUnit, isSuperAdmin } = req;

    const doc = await RagDocument.findById(id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isSuperAdmin && doc.businessUnit !== businessUnit) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Delete chunks, Cloudinary file, and DB record in parallel
    await Promise.all([
      cleanupDocumentChunks(id),
      deleteDocument(doc.cloudinaryPublicId)
    ]);
    await RagDocument.findByIdAndDelete(id);

    logger.info("[AdminDocuments] Document deleted", { documentId: id });
    res.json({ success: true });
  } catch (err) {
    logger.error("[AdminDocuments] Delete error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to delete document" });
  }
});
