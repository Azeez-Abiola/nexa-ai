import { Types } from "mongoose";
import { RagDocument } from "../models/RagDocument";
import { DocumentChunk } from "../models/DocumentChunk";
import { getDocumentBuffer } from "./cloudinaryService";
import { chunkText, parseCSV } from "./chunkingService";
import { generateEmbeddingBatch } from "./embeddingService";
import { logProcessingStarted, logProcessingCompleted, logProcessingFailed } from "./auditService";
import { extractTextFromPdf } from "../utils/pdfParser";
import { extractTextFromDocx } from "../utils/docxParser";
import { extractTextFromXlsx } from "../utils/xlsxParser";
import { extractTextFromPptx } from "../utils/pptxParser";
import logger from "../utils/logger";

export interface ProcessingJob {
  documentId: string;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  mimeType: string;
  businessUnit: string;
  /** Hex string ObjectIds from the job queue */
  allowedGroupIds: string[];
  sensitivityLevel: string;
  uploadedBy: {
    adminId: string;
    adminEmail: string;
    adminName: string;
  };
}

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractTextFromPdf(buffer);
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractTextFromDocx(buffer);
  }
  if (mimeType === "text/csv") {
    return parseCSV(buffer);
  }
  if (mimeType === "text/plain") {
    return buffer.toString("utf-8");
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return extractTextFromXlsx(buffer);
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    return extractTextFromPptx(buffer);
  }
  throw new Error(`Unsupported mimeType: ${mimeType}`);
}

export async function processDocument(job: ProcessingJob): Promise<void> {
  const {
    documentId,
    cloudinaryPublicId,
    cloudinaryUrl,
    mimeType,
    businessUnit,
    allowedGroupIds: allowedGroupIdStrings,
    sensitivityLevel
  } = job;

  const allowedGroupObjectIds: Types.ObjectId[] = (allowedGroupIdStrings || [])
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  logger.info("[DocumentProcessing] Starting", { documentId });

  const doc = await RagDocument.findById(documentId);
  if (!doc) throw new Error(`RagDocument ${documentId} not found`);

  logProcessingStarted(documentId, businessUnit, cloudinaryPublicId);

  try {
    // Step 1: Fetch file buffer from Cloudinary
    await RagDocument.findByIdAndUpdate(documentId, { processingStatus: "extracting" });
    const buffer = await getDocumentBuffer(cloudinaryUrl);
    logger.info("[DocumentProcessing] Fetched buffer", { documentId, bytes: buffer.length });

    // Step 2: Extract text
    const text = await extractText(buffer, mimeType);
    if (!text || text.trim().length === 0) {
      throw new Error("Extracted text is empty — document may be scanned or corrupt");
    }
    logger.info("[DocumentProcessing] Text extracted", { documentId, chars: text.length });

    // Step 3: Chunk text
    await RagDocument.findByIdAndUpdate(documentId, { processingStatus: "chunking" });
    const chunks = chunkText(text);
    logger.info("[DocumentProcessing] Chunked", { documentId, totalChunks: chunks.length });

    if (chunks.length === 0) {
      throw new Error("No chunks produced from document text");
    }

    // Step 4: Generate embeddings for all chunks in batches
    await RagDocument.findByIdAndUpdate(documentId, { processingStatus: "embedding" });
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddingBatch(chunkTexts);
    logger.info("[DocumentProcessing] Embeddings generated", { documentId, count: embeddings.length });

    // Step 5: Bulk insert DocumentChunk records
    const chunkDocs = chunks.map((chunk, i) => ({
      documentId: doc._id,
      businessUnit,
      allowedGroupIds: allowedGroupObjectIds,
      sensitivityLevel,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[i],
      metadata: {
        documentTitle: doc.title,
        documentType: doc.documentType,
        documentSeriesId: doc.documentSeriesId,
        version: doc.version,
        isLatestVersion: doc.isLatestVersion,
        sourceRange: chunk.sourceRange
      }
    }));

    await DocumentChunk.insertMany(chunkDocs, { ordered: false });
    logger.info("[DocumentProcessing] Chunks stored", { documentId, count: chunkDocs.length });

    // Step 6: Mark document as completed
    await RagDocument.findByIdAndUpdate(documentId, {
      processingStatus: "completed",
      totalChunks: chunkDocs.length,
      embeddedAt: new Date(),
      processingError: null
    });

    logger.info("[DocumentProcessing] Completed", { documentId, totalChunks: chunkDocs.length });
    logProcessingCompleted(documentId, businessUnit, chunkDocs.length);
  } catch (err: any) {
    logger.error("[DocumentProcessing] Failed", { documentId, error: err.message });
    await RagDocument.findByIdAndUpdate(documentId, {
      processingStatus: "failed",
      processingError: err.message || "Unknown error"
    });
    logProcessingFailed(documentId, businessUnit, err.message);
    throw err;
  }
}

export async function cleanupDocumentChunks(documentId: string): Promise<void> {
  const result = await DocumentChunk.deleteMany({ documentId });
  logger.info("[DocumentProcessing] Cleaned up chunks", { documentId, deleted: result.deletedCount });
}
