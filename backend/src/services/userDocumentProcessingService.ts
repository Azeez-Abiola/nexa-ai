import { UserDocument } from "../models/UserDocument";
import { UserDocumentChunk } from "../models/UserDocumentChunk";
import { getDocumentBuffer } from "./cloudinaryService";
import { chunkText, parseCSV } from "./chunkingService";
import { generateEmbeddingBatch } from "./embeddingService";
import { extractTextFromPdf } from "../utils/pdfParser";
import { extractTextFromDocx } from "../utils/docxParser";
import { extractTextFromXlsx } from "../utils/xlsxParser";
import { extractTextFromPptx } from "../utils/pptxParser";
import logger from "../utils/logger";

export interface UserProcessingJob {
  documentId: string;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  mimeType: string;
  userId: string;
  chatSessionId: string;
  fileName: string;
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
  throw new Error(`Unsupported file type: ${mimeType}`);
}

export async function processUserDocument(job: UserProcessingJob): Promise<void> {
  const { documentId, cloudinaryUrl, mimeType, userId, chatSessionId, fileName } = job;

  logger.info("[UserDocProcessing] Starting", { documentId, userId, chatSessionId, fileName });

  const doc = await UserDocument.findById(documentId);
  if (!doc) throw new Error(`UserDocument ${documentId} not found`);

  try {
    // Mark as processing
    await UserDocument.findByIdAndUpdate(documentId, { status: "processing" });

    // Step 1: Fetch file buffer from Cloudinary
    const buffer = await getDocumentBuffer(cloudinaryUrl);
    logger.info("[UserDocProcessing] Fetched buffer", { documentId, bytes: buffer.length });

    // Step 2: Extract text
    const text = await extractText(buffer, mimeType);
    if (!text || text.trim().length === 0) {
      throw new Error("Extracted text is empty — document may be scanned, encrypted, or unreadable");
    }
    logger.info("[UserDocProcessing] Text extracted", { documentId, chars: text.length });

    // Step 3: Chunk text (300–800 tokens, 10–20% overlap)
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("No chunks produced from document text");
    }
    logger.info("[UserDocProcessing] Chunked", { documentId, totalChunks: chunks.length });

    // Step 4: Generate embeddings in batches
    const chunkTexts = chunks.map((c) => c.content);
    const embeddings = await generateEmbeddingBatch(chunkTexts);
    logger.info("[UserDocProcessing] Embeddings generated", { documentId, count: embeddings.length });

    // Step 5: Bulk insert UserDocumentChunk records
    const chunkDocs = chunks.map((chunk, i) => ({
      documentId: doc._id,
      userId,
      chatSessionId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embedding: embeddings[i],
      metadata: {
        documentTitle: fileName,
        fileName,
        sourceRange: chunk.sourceRange
      }
    }));

    await UserDocumentChunk.insertMany(chunkDocs, { ordered: false });
    logger.info("[UserDocProcessing] Chunks stored", { documentId, count: chunkDocs.length });

    // Step 6: Mark document as ready
    await UserDocument.findByIdAndUpdate(documentId, {
      status: "ready",
      totalChunks: chunkDocs.length,
      processingError: null
    });

    logger.info("[UserDocProcessing] Completed successfully", {
      documentId,
      fileName,
      totalChunks: chunkDocs.length,
      userId,
      chatSessionId
    });
  } catch (err: any) {
    logger.error("[UserDocProcessing] Failed", { documentId, fileName, error: err.message });
    await UserDocument.findByIdAndUpdate(documentId, {
      status: "failed",
      processingError: err.message || "Unknown error"
    });
    throw err;
  }
}

export async function cleanupUserDocumentChunks(documentId: string): Promise<void> {
  const result = await UserDocumentChunk.deleteMany({ documentId });
  logger.info("[UserDocProcessing] Cleaned up chunks", { documentId, deleted: result.deletedCount });
}
