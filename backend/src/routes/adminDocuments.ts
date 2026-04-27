import express from "express";
import multer from "multer";
import crypto from "crypto";
import { Types } from "mongoose";
import { RagDocument } from "../models/RagDocument";
import { DocumentChunk } from "../models/DocumentChunk";
import { KnowledgeGroup } from "../models/KnowledgeGroup";
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
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv"
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, XLSX, PPTX, TXT, and CSV files are allowed"));
    }
  }
});

adminDocumentsRouter.use(adminAuthMiddleware);

/**
 * Collapse a title to its stable "series key" so repeat uploads of the same logical document
 * resolve to the same row regardless of version markers, years, or draft/final tags in the title.
 * Kept deliberately conservative — only exact normalized matches auto-link.
 */
function normalizeTitleForMatching(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\b(v|ver|version|rev|revision)\s*\.?\s*\d+(\.\d+)*\b/g, "")
    .replace(/\((final|draft|latest|current|updated)\)/g, "")
    .replace(/\b20\d{2}\b/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── List documents ────────────────────────────────────────────────────────────
adminDocumentsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { businessUnit, isSuperAdmin } = req;
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const skip = (page - 1) * limit;

    const includeSuperseded = req.query.includeSuperseded === "true";
    const filter: Record<string, unknown> = isSuperAdmin ? {} : { businessUnit };
    if (!includeSuperseded) {
      filter.processingStatus = { $ne: "superseded" };
    }

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
    const { title, documentType, sensitivityLevel, content, department } = req.body;
    const file = req.file;
    const { businessUnit: tokenBU, adminId, email: adminEmail, fullName: adminName, isSuperAdmin } = req;

    const textContent = typeof content === "string" ? content.trim() : "";
    if (!file && !textContent) {
      return res.status(400).json({ error: "Either a file or pasted content is required" });
    }
    if (!title) return res.status(400).json({ error: "title is required" });
    if (!sensitivityLevel) return res.status(400).json({ error: "sensitivityLevel is required" });

    const docType = (documentType || "policy").toLowerCase();
    const allowedTypes = ["policy", "procedure", "handbook", "contract", "report", "other"];
    if (!allowedTypes.includes(docType)) {
      return res.status(400).json({ error: "Invalid documentType" });
    }

    const targetBU = isSuperAdmin ? (req.body.businessUnit || tokenBU) : tokenBU;
    if (isSuperAdmin && !req.body.businessUnit) {
      return res.status(400).json({ error: "SUPERADMIN must specify a businessUnit" });
    }

    let replaceIdRaw =
      typeof req.body.replacesDocumentId === "string" ? req.body.replacesDocumentId.trim() : "";
    const forceNewSeries = req.body.forceNewSeries === "true" || req.body.forceNewSeries === true;
    let documentSeriesId: string = crypto.randomUUID();
    let nextVersion = 1;
    let supersedesId: Types.ObjectId | null = null;
    let autoLinkedFromAutoDetect = false;

    // Auto-detect: same BU + normalized title match → treat as next version without asking the admin.
    // The retrieval layer resolves "latest version" on its own, so the upload side just needs the
    // series graph to be right. Skipped if admin explicitly picked a parent or opted out.
    if (!replaceIdRaw && !forceNewSeries) {
      const normalized = normalizeTitleForMatching(title);
      if (normalized) {
        const candidates = await RagDocument.find({
          businessUnit: targetBU,
          isLatestVersion: true,
          processingStatus: { $ne: "superseded" }
        })
          .select("_id title version documentSeriesId originalFilename createdAt")
          .lean();
        const matches = candidates.filter((c) => normalizeTitleForMatching(c.title) === normalized);
        if (matches.length === 1) {
          replaceIdRaw = String(matches[0]._id);
          autoLinkedFromAutoDetect = true;
        } else if (matches.length > 1) {
          return res.status(409).json({
            error: "ambiguous_title_match",
            message:
              "More than one existing document has a similar title. Pick which one this upload continues, or upload as an unrelated document.",
            candidates: matches.map((m) => ({
              _id: String(m._id),
              title: m.title,
              version: m.version,
              originalFilename: m.originalFilename,
              createdAt: m.createdAt
            }))
          });
        }
      }
    }

    if (replaceIdRaw) {
      if (!Types.ObjectId.isValid(replaceIdRaw)) {
        return res.status(400).json({ error: "Invalid replacesDocumentId" });
      }
      const parent = await RagDocument.findById(replaceIdRaw);
      if (!parent) return res.status(404).json({ error: "Document to replace was not found" });
      if (parent.businessUnit !== targetBU) {
        return res.status(403).json({ error: "Cannot replace a document from another business unit" });
      }
      if (parent.processingStatus === "superseded") {
        return res.status(400).json({
          error: "That document is already superseded; open the latest version and upload from there"
        });
      }
      const series =
        parent.documentSeriesId && String(parent.documentSeriesId).length > 0
          ? String(parent.documentSeriesId)
          : parent._id.toString();
      if (!parent.documentSeriesId || String(parent.documentSeriesId).length === 0) {
        await RagDocument.findByIdAndUpdate(parent._id, { documentSeriesId: series });
      }
      documentSeriesId = series;
      nextVersion = (parent.version || 1) + 1;
      supersedesId = parent._id as Types.ObjectId;

      await cleanupDocumentChunks(parent._id.toString());
      await RagDocument.findByIdAndUpdate(parent._id, {
        documentSeriesId: series,
        processingStatus: "superseded",
        isLatestVersion: false,
        totalChunks: 0,
        embeddedAt: null
      });
    }

    const allowedGroupIdsRaw = req.body.allowedGroupIds;
    const groupIdStrings: string[] = Array.isArray(allowedGroupIdsRaw)
      ? allowedGroupIdsRaw.map(String)
      : typeof allowedGroupIdsRaw === "string" && allowedGroupIdsRaw.trim()
      ? allowedGroupIdsRaw.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    const parsedGroupObjectIds: Types.ObjectId[] = [];
    for (const gid of groupIdStrings) {
      if (!Types.ObjectId.isValid(gid)) {
        return res.status(400).json({ error: `Invalid user group id: ${gid}` });
      }
      parsedGroupObjectIds.push(new Types.ObjectId(gid));
    }
    if (parsedGroupObjectIds.length > 0) {
      const found = await KnowledgeGroup.find({
        _id: { $in: parsedGroupObjectIds },
        businessUnit: targetBU
      }).select("_id");
      if (found.length !== parsedGroupObjectIds.length) {
        return res.status(400).json({ error: "One or more user groups are invalid for this business unit" });
      }
    }

    let uploadBuffer: Buffer;
    let originalFilename: string;
    let mimeType: string;
    let fileSize: number;

    if (file) {
      uploadBuffer = file.buffer;
      originalFilename = file.originalname;
      mimeType = file.mimetype;
      fileSize = file.size;
    } else {
      uploadBuffer = Buffer.from(textContent, "utf-8");
      originalFilename = `pasted-content-${Date.now()}.txt`;
      mimeType = "text/plain";
      fileSize = uploadBuffer.length;
    }

    // Upload to Cloudinary
    const { publicId, secureUrl } = await uploadDocument(
      uploadBuffer,
      originalFilename,
      targetBU!,
      mimeType
    );

    // Create RagDocument record
    const trimmedDepartment = typeof department === "string" ? department.trim() : "";
    const doc = await RagDocument.create({
      title,
      businessUnit: targetBU,
      department: trimmedDepartment || undefined,
      documentType: docType,
      sensitivityLevel,
      documentSeriesId,
      version: nextVersion,
      isLatestVersion: true,
      supersedesDocumentId: supersedesId,
      allowedGroupIds: parsedGroupObjectIds,
      uploadedBy: {
        adminId: adminId || "unknown",
        adminEmail: adminEmail || "unknown",
        adminName: adminName || "Unknown"
      },
      cloudinaryPublicId: publicId,
      cloudinaryUrl: secureUrl,
      originalFilename,
      mimeType,
      fileSize,
      processingStatus: "pending"
    });

    // Enqueue processing job
    const job = await documentQueue.add(
      "process-document",
      {
        documentId: doc._id.toString(),
        cloudinaryPublicId: publicId,
        cloudinaryUrl: secureUrl,
        mimeType,
        businessUnit: targetBU!,
        allowedGroupIds: parsedGroupObjectIds.map((g) => g.toString()),
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
      filename: originalFilename,
      fileSize,
      mimeType,
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
        documentType: docType,
        sensitivityLevel: doc.sensitivityLevel,
        allowedGroupIds: doc.allowedGroupIds,
        documentSeriesId: doc.documentSeriesId,
        version: doc.version,
        supersedesDocumentId: doc.supersedesDocumentId,
        originalFilename: doc.originalFilename,
        fileSize: doc.fileSize,
        processingStatus: doc.processingStatus,
        processingJobId: job.id,
        createdAt: doc.createdAt
      },
      autoLinked: autoLinkedFromAutoDetect,
      message: "Document uploaded. Processing started in background."
    });
  } catch (err) {
    logger.error("[AdminDocuments] Upload error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// ─── Edit access (user groups) — no reprocess needed, chunks are cascaded ─────
adminDocumentsRouter.patch("/:id/access", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { businessUnit: tokenBU, isSuperAdmin } = req;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid document id" });

    const doc = await RagDocument.findById(id);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (!isSuperAdmin && doc.businessUnit !== tokenBU) {
      return res.status(403).json({ error: "Access denied" });
    }

    const rawGroupIds = req.body.allowedGroupIds;
    const groupIdStrings: string[] = Array.isArray(rawGroupIds)
      ? rawGroupIds.map(String)
      : typeof rawGroupIds === "string"
      ? rawGroupIds.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];
    const groupObjectIds: Types.ObjectId[] = [];
    for (const gid of groupIdStrings) {
      if (!Types.ObjectId.isValid(gid)) {
        return res.status(400).json({ error: `Invalid user group id: ${gid}` });
      }
      groupObjectIds.push(new Types.ObjectId(gid));
    }
    if (groupObjectIds.length > 0) {
      const found = await KnowledgeGroup.find({
        _id: { $in: groupObjectIds },
        businessUnit: doc.businessUnit
      }).select("_id");
      if (found.length !== groupObjectIds.length) {
        return res.status(400).json({ error: "One or more user groups are invalid for this business unit" });
      }
    }

    doc.allowedGroupIds = groupObjectIds as any;
    await doc.save();

    // Cascade access rules to the chunks — vector search pre-filter reads from chunks, not docs.
    await DocumentChunk.updateMany(
      { documentId: doc._id },
      { $set: { allowedGroupIds: groupObjectIds } }
    );

    res.json({
      document: {
        _id: doc._id,
        allowedGroupIds: doc.allowedGroupIds
      }
    });
  } catch (err) {
    logger.error("[AdminDocuments] Access edit error", { error: (err as Error).message });
    res.status(500).json({ error: "Failed to update document access" });
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
    if (doc.processingStatus === "superseded") {
      return res.status(400).json({ error: "Cannot reprocess a superseded document" });
    }

    const groupStrings = (doc.allowedGroupIds || []).map((g) => g.toString());

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
        allowedGroupIds: groupStrings,
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
