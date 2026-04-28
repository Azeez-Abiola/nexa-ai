import express from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { generateDocumentContent, DocumentType } from "../services/documentAIService";
import {
  generateDocxBuffer,
  generateXlsxBuffer,
  generatePptxBuffer,
  generatePdfBuffer,
  DocxContent,
  XlsxContent,
  PptxContent,
} from "../services/documentGeneratorService";
import logger from "../utils/logger";

export const documentGenerationRouter = express.Router();

const MIME_TYPES: Record<DocumentType, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
};

const EXTENSIONS: Record<DocumentType, string> = {
  docx: "docx",
  xlsx: "xlsx",
  pptx: "pptx",
  pdf: "pdf",
};

documentGenerationRouter.post(
  "/generate-document",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    const { prompt, documentType } = req.body as {
      prompt?: string;
      documentType?: string;
    };

    if (!prompt?.trim()) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const validTypes: DocumentType[] = ["docx", "xlsx", "pptx", "pdf"];
    if (!documentType || !validTypes.includes(documentType as DocumentType)) {
      return res.status(400).json({ error: "documentType must be one of: docx, xlsx, pptx, pdf" });
    }

    const docType = documentType as DocumentType;
    const userId = req.userId ?? "unknown";

    try {
      logger.info("Document generation started", { userId, documentType: docType });

      const content = await generateDocumentContent(prompt.trim(), docType);

      let buffer: Buffer;
      if (docType === "docx") {
        buffer = await generateDocxBuffer(content as DocxContent);
      } else if (docType === "xlsx") {
        buffer = generateXlsxBuffer(content as XlsxContent);
      } else if (docType === "pptx") {
        buffer = await generatePptxBuffer(content as PptxContent);
      } else {
        buffer = await generatePdfBuffer(content as DocxContent);
      }

      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const filename = `nexa-document-${timestamp}.${EXTENSIONS[docType]}`;

      res.setHeader("Content-Type", MIME_TYPES[docType]);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);

      logger.info("Document generation completed", {
        userId,
        documentType: docType,
        sizeBytes: buffer.length,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Document generation failed";
      logger.error("Document generation error", { userId, documentType: docType, error: msg });
      res.status(500).json({ error: msg });
    }
  }
);
