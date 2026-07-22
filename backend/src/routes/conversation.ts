import express, { Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { Types } from "mongoose";
import { Conversation, ChatMessage } from "../models/Conversation";
import { UserDocument } from "../models/UserDocument";
import { RagDocument } from "../models/RagDocument";
import { KnowledgeGroup } from "../models/KnowledgeGroup";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import {
  generateConversationTitle,
  ImageAttachment
} from "../services/openaiService";
import { parseModel, getStreamAIResponse, getGenerateAIResponse, getModelLabel, AIModel } from "../services/aiRouter";
import { buildContextForQuery } from "../utils/contextBuilder";
import { KNOWLEDGE_BASE_VERSIONING_RULES } from "../prompts/knowledgeBaseBehavior";
import { uploadDocument, uploadChatImage } from "../services/cloudinaryService";
import { userDocumentQueue } from "../queue/userDocumentQueue";
import {
  hasReadySessionChunks,
  retrieveSessionChunks,
  buildSessionRAGContext,
  getSessionDocumentsText,
  getSessionDocumentStatus
} from "../services/sessionRagService";
import logger from "../utils/logger";
import { isSimpleQuery } from "../utils/queryClassifier";
import { extractTextFromPdf } from "../utils/pdfParser";
import { extractTextFromDocx } from "../utils/docxParser";
import { extractTextFromXlsx } from "../utils/xlsxParser";
import { extractTextFromPptx } from "../utils/pptxParser";
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
import { randomUUID } from "crypto";
import { ConversationFolder } from "../models/ConversationFolder";
import {
  syncToCollaborators,
  getCollaborationRoomId,
  isCollaborationParticipant,
  syncPinnedMessageToCollaborators,
  syncReactionToCollaborators,
} from "../utils/syncCollaboration";
import { serializeMessages } from "../utils/encryption";
import { sanitizeAssistantResponse } from "../utils/citationCleanup";
import { buildRagMessageSources, buildWebMessageSources } from "../utils/buildMessageSources";
import {
  setTypingIndicator,
  clearTypingIndicator,
  getTypingUsers,
} from "../services/typingIndicatorService";

const DOC_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedDoc {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  expiresAt: number;
}

const docCache = new Map<string, CachedDoc>();

function cacheDocument(buffer: Buffer, filename: string, mimeType: string): string {
  const id = randomUUID();
  docCache.set(id, { buffer, filename, mimeType, expiresAt: Date.now() + DOC_TTL_MS });
  for (const [k, v] of docCache) {
    if (v.expiresAt < Date.now()) docCache.delete(k);
  }
  return id;
}

/** Assign stable messageIds to legacy messages so pin/react work on older chats. */
function ensureMessageIds(group: { messages: ChatMessage[] }): boolean {
  let changed = false;
  for (const m of group.messages) {
    if (!m.messageId) {
      m.messageId = randomUUID();
      changed = true;
    }
  }
  return changed;
}

const DOC_LABELS: Record<DocumentType, string> = {
  docx: "Word document",
  xlsx: "Excel spreadsheet",
  pptx: "PowerPoint presentation",
  pdf: "PDF document",
};

function detectDocumentRequest(message: string): { type: DocumentType; label: string } | null {
  const m = message.toLowerCase();

  if (
    /(?:create|generate|make|give|build|write|produce|prepare|draft)\s+(?:a\s+|an\s+|me\s+(?:a\s+|an\s+)?)?(?:powerpoint|presentation|slideshow|slide\s*deck|ppt(?:x)?)\b/.test(m) ||
    /(?:powerpoint|presentation|pptx)\s+(?:on|about|for|of)/.test(m) ||
    /\bpptx\b/.test(m)
  ) {
    return { type: "pptx", label: DOC_LABELS.pptx };
  }

  if (
    /(?:create|generate|make|give|build|write|produce|prepare)\s+(?:a\s+|an\s+|me\s+(?:a\s+|an\s+)?)?(?:excel|spreadsheet|xlsx?)/.test(m) ||
    /(?:excel|spreadsheet)\s+(?:with|for|about|on|of)/.test(m) ||
    /in\s+excel\s+(?:form|format|file)?/.test(m) ||
    /(?:save|export)\s+(?:as|to)\s+(?:excel|xlsx)/.test(m) ||
    /\bxlsx?\b/.test(m)
  ) {
    return { type: "xlsx", label: DOC_LABELS.xlsx };
  }

  if (
    /(?:create|generate|make|give|build|write|produce|prepare|save\s+as?)\s+(?:a\s+|an\s+|me\s+(?:a\s+|an\s+)?)?pdf/.test(m) ||
    /\bpdf\s+(?:document|report|file|format)\b/.test(m) ||
    /(?:document|report|file|letter|it)\s+(?:in|as)\s+(?:a\s+)?pdf/.test(m) ||
    /in\s+(?:a\s+)?pdf\b/.test(m) ||
    /as\s+(?:a\s+)?pdf\b/.test(m) ||
    /in\s+pdf\s+(?:form|format)/.test(m)
  ) {
    return { type: "pdf", label: DOC_LABELS.pdf };
  }

  if (
    /(?:create|generate|make|give|build|write|produce|prepare|draft)\s+(?:a\s+|an\s+|me\s+(?:a\s+|an\s+)?)?(?:word\s+(?:document|doc|file)|docx?)/.test(m) ||
    /(?:word\s+document|word\s+file|\.docx)/.test(m) ||
    /(?:save|export)\s+(?:as|to)\s+(?:word|docx)/.test(m) ||
    /\bdocx\b/.test(m)
  ) {
    return { type: "docx", label: DOC_LABELS.docx };
  }

  return null;
}

const MIME_TYPES: Record<DocumentType, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
};

interface GeneratedDocResult {
  url: string;
  filename: string;
  documentType: string;
}

async function generateAndCacheDocument(
  prompt: string,
  docType: DocumentType,
  model: AIModel = "gpt"
): Promise<GeneratedDocResult> {
  const content = await generateDocumentContent(prompt, docType, model);

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
  const filename = `nexa-${docType}-${timestamp}.${docType}`;
  const mimeType = MIME_TYPES[docType];

  const id = cacheDocument(buffer, filename, mimeType);
  const downloadUrl = `/api/v1/conversations/download-doc/${id}`;

  logger.info("[DocumentGen] Document cached", { filename, id });
  return { url: downloadUrl, filename, documentType: docType };
}

export const conversationRouter = express.Router();

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel", // legacy .xls — SheetJS reads it fine
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
];

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const MAX_FILE_SIZE_BYTES = parseInt(process.env.USER_UPLOAD_MAX_FILE_SIZE_MB || "10") * 1024 * 1024;
const MAX_FILES_PER_REQUEST = parseInt(process.env.USER_UPLOAD_MAX_FILES_PER_REQUEST || "5");
const MAX_FILES_PER_SESSION = parseInt(process.env.USER_UPLOAD_MAX_FILES_PER_SESSION || "10");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOCX, XLSX, PPTX, TXT, CSV, and image (JPG, PNG, GIF, WebP) files are allowed"));
    }
  }
});

// Wrapped in a promise so it can be awaited inside async route handlers and errors caught with try/catch.
function runMulter(req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.array("files", MAX_FILES_PER_REQUEST)(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function handleFileUploads(
  files: Express.Multer.File[],
  userId: string,
  chatSessionId: string,
  businessUnit: string
): Promise<{ fileName: string; status: string; documentId: string }[]> {
  const results: { fileName: string; status: string; documentId: string }[] = [];

  for (const file of files) {
    try {
      const { publicId, secureUrl } = await uploadDocument(
        file.buffer,
        file.originalname,
        `user-uploads/${businessUnit}`,
        file.mimetype
      );

      const doc = await UserDocument.create({
        userId,
        chatSessionId,
        fileUrl: secureUrl,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        cloudinaryPublicId: publicId,
        status: "pending"
      });

      await userDocumentQueue.add(
        `process-${doc._id}`,
        {
          documentId: doc._id.toString(),
          cloudinaryPublicId: publicId,
          cloudinaryUrl: secureUrl,
          mimeType: file.mimetype,
          userId,
          chatSessionId,
          fileName: file.originalname
        }
      );

      logger.info("[Conversation] Document upload queued", {
        documentId: doc._id,
        fileName: file.originalname,
        userId,
        chatSessionId
      });

      results.push({ fileName: file.originalname, status: "pending", documentId: doc._id.toString() });
    } catch (err: any) {
      logger.error("[Conversation] File upload failed", {
        fileName: file.originalname,
        error: err.message
      });
      // Partial failure should not block the rest of the chat message.
      results.push({ fileName: file.originalname, status: "failed", documentId: "" });
    }
  }

  return results;
}

// How much of an uploaded document is read inline on the turn it is attached.
// Sized against the model's context window (~30k tokens), not an arbitrary floor —
// the previous 15k cap silently dropped everything past ~6 pages, so the model
// answered as though it had read a whole document it had only partly seen.
// Documents longer than this still truncate, but the excerpt is explicitly labelled
// (see below) so the model can say what it is missing instead of inventing it.
const MAX_INLINE_TEXT_CHARS = 120000;

type ExtractionFailureReason = "scanned_pdf" | "unsupported_type" | "error";

async function extractTextFromFile(
  file: Express.Multer.File
): Promise<{ text: string; ok: boolean; reason?: ExtractionFailureReason }> {
  try {
    switch (file.mimetype) {
      case "application/pdf": {
        const pdfText = await extractTextFromPdf(file.buffer);
        // A PDF with no recoverable text layer is almost always a scan or photo.
        // Extraction here is text-layer only (no OCR), so say so specifically rather
        // than reporting a generic processing failure the user can't act on.
        if (!pdfText || pdfText.trim().length < 20) {
          logger.warn("[Conversation] PDF has no extractable text layer (likely scanned)", {
            fileName: file.originalname,
            bytes: file.size
          });
          return { text: "", ok: false, reason: "scanned_pdf" };
        }
        return { text: pdfText, ok: true };
      }
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return { text: await extractTextFromDocx(file.buffer), ok: true };
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      case "application/vnd.ms-excel":
        return { text: extractTextFromXlsx(file.buffer), ok: true };
      case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        return { text: await extractTextFromPptx(file.buffer), ok: true };
      case "text/plain":
      case "text/csv":
        return { text: file.buffer.toString("utf-8"), ok: true };
      default:
        return { text: "", ok: false, reason: "unsupported_type" };
    }
  } catch (err: any) {
    logger.warn("[Conversation] Inline text extraction failed", { fileName: file.originalname, error: err.message });
    return { text: "", ok: false, reason: "error" };
  }
}

// Two-part match: the query must mention a KB noun AND an inventory/quantity intent.
// Kept deliberately permissive — a false positive only adds a doc list to the prompt,
// whereas a miss leaves the model counting the handful of retrieved chunks.
const KB_NOUN_RE = /\b(knowledge ?base|kb|kbs|documents?|files?|policy|policies|uploads?|uploaded)\b/i;
const KB_INTENT_RE = /\b(how many|how much|numbers?|count|counting|total|list|listing|inventory|all (of|the)|what (are|documents|files|do)|which (documents|files))\b/i;
const isKbInventoryQuery = (q: string): boolean => KB_NOUN_RE.test(q) && KB_INTENT_RE.test(q);

/**
 * The chat model only ever sees the top-K retrieved chunks, so it cannot count the
 * knowledge base — asked "how many documents do we have?" it just counts the excerpts
 * in front of it. When the query is an inventory question, give it the real totals
 * (latest, fully-processed documents for the business unit) so it answers accurately.
 *
 * Access is enforced the same way as chunk retrieval: open documents (no/empty
 * allowedGroupIds) are visible to everyone; restricted ones require the user to be a
 * member of at least one of the document's knowledge groups. This prevents leaking
 * the titles of documents the user cannot otherwise see.
 */
async function buildKbInventoryNote(
  businessUnit: string,
  query: string,
  userId?: string
): Promise<string> {
  if (!isKbInventoryQuery(query)) return "";
  try {
    const uid = userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : null;
    const groups = uid
      ? await KnowledgeGroup.find({ businessUnit, memberUserIds: uid }).select("_id").lean()
      : [];
    const groupIds = groups.map((g) => g._id as Types.ObjectId);

    const accessOr: Record<string, unknown>[] = [
      { allowedGroupIds: { $exists: false } },
      { allowedGroupIds: { $size: 0 } }
    ];
    if (groupIds.length > 0) accessOr.push({ allowedGroupIds: { $in: groupIds } });

    const docs = await RagDocument.find(
      { businessUnit, isLatestVersion: true, processingStatus: "completed", $or: accessOr },
      { title: 1 }
    ).sort({ title: 1 }).lean();
    if (docs.length === 0) return "";
    const titles = docs.map((d: any, i: number) => `${i + 1}. ${d.title}`).join("\n");
    return `\n\nKNOWLEDGE BASE INVENTORY (authoritative — this is the COMPLETE list of documents in the knowledge base you can access, not limited to the excerpts retrieved above. Use it for any "how many / list / what documents" question):\nTotal documents: ${docs.length}\n${titles}`;
  } catch {
    return "";
  }
}

function buildSystemPrompt(
  businessUnit: string,
  sessionContextString: string,
  globalContextString: string,
  pendingFileNames: string[],
  hasGlobalContext: boolean,
  contextSource: "rag" | "keyword" | "none" = "none",
  activeModel: "gpt" | "claude" | "kimi" | "deepseek" = "gpt",
  failedFileNames: string[] = [],
  scannedFileNames: string[] = []
): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const modelLabel = getModelLabel(activeModel);
  const sections: string[] = [
    `You are Nexa AI, a helpful AI assistant for ${businessUnit}, a business unit of UACN, powered by ${modelLabel}. Today's date is ${today}. If asked which model or AI you use, say you are Nexa AI powered by ${modelLabel}. Users can switch between models at any time — if the model differs from a previous message, do not apologize or treat it as an error; simply state the current model naturally.`
  ];

  if (pendingFileNames.length > 0) {
    sections.push(
      `⏳ NOTE: The following document(s) uploaded by the user are still being processed and cannot be queried yet:\n${pendingFileNames.map((f) => `  • ${f}`).join("\n")}\nIf the user asks about these files, let them know processing is in progress and to try again shortly.`
    );
  }

  if (failedFileNames.length > 0) {
    sections.push(
      `❌ NOTE: The following uploaded document(s) failed to process and cannot be analyzed:\n${failedFileNames.map((f) => `  • ${f}`).join("\n")}\nIf the user asks about these files, explain that processing failed and suggest re-uploading in a supported format (PDF, DOCX, XLSX, PPTX, TXT, CSV) or using a text-based version.`
    );
  }

  if (scannedFileNames.length > 0) {
    sections.push(
      `🖼️ NOTE: The following PDF(s) contain no readable text layer — they are scanned images or photographs of pages:\n${scannedFileNames.map((f) => `  • ${f}`).join("\n")}\nYou received NO content from them, so you cannot answer anything about what they contain. Do not guess. Tell the user the file appears to be a scanned/image-based PDF that cannot be read as text, and ask for a text-based PDF, the original Word/Excel file, or the text pasted into the chat.`
    );
  }

  if (sessionContextString) {
    sections.push(sessionContextString);
  }

  if (globalContextString && hasGlobalContext) {
    sections.push(`📋 COMPANY KNOWLEDGE BASE (general policies & internal documents):\n\n${globalContextString}`);
  }

  sections.push(`INSTRUCTIONS:
1. When answering questions about the user's uploaded documents, use the "YOUR UPLOADED DOCUMENTS" context as your PRIMARY source.
2. For HR policies or general company knowledge, use the "COMPANY KNOWLEDGE BASE" section as your PRIMARY source.
3. **You have a live web_search tool. USE IT whenever the question involves current events, recent developments, news, sports, prices, dates, or anything that may have changed since your training cutoff.** When you use it:
   - Base your answer on what the search results actually say. Do NOT invent specific details (match times, scores, dates, names, prices) that the results don't state.
   - Cite the sources you used. If the results are thin on a detail the user wants, say what you found and point them to the source rather than guessing.
   - Do NOT add disclaimers like "my knowledge is limited to 2023" or "I can't access the internet" — you can search the web. Just search and answer honestly.
4. For questions outside all provided sources that don't need fresh data, answer from your own training knowledge. If information may be stale, add a brief "(based on what I know — details may have changed)" note. Never refuse outright.
5. You can perform ANY task: summarization, Q&A, extraction, analysis, transformation, explanation, brainstorming, writing help.
6. If context from uploaded documents is insufficient or missing for a document-specific question, say so honestly — do NOT hallucinate document-specific facts. This only applies to questions ABOUT uploaded documents, not general questions.
7. Only label the source of your answer when it improves clarity:
   - 📄 for user-uploaded document answers
   - 📋 for company knowledge base answers
   - 🌐 for external web sources you searched
   - No badge for general knowledge / conversational replies.
8. Be professional, helpful, and concise.

${KNOWLEDGE_BASE_VERSIONING_RULES}`);

  return sections.join("\n\n");
}

conversationRouter.get("/folders", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folders = await ConversationFolder.find({ userId: req.userId }).sort({ createdAt: 1 });
    res.json({ folders });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.post("/folders", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "name is required" });
    const folder = await ConversationFolder.create({
      userId: req.userId,
      businessUnit: req.businessUnit || "",
      name,
      conversationIds: [],
    });
    res.status(201).json({ folder });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.patch("/folders/:folderId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (!name) return res.status(400).json({ error: "name is required" });
    const folder = await ConversationFolder.findOneAndUpdate(
      { _id: req.params.folderId, userId: req.userId },
      { $set: { name } },
      { new: true }
    );
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    res.json({ folder });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.delete("/folders/:folderId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ConversationFolder.deleteOne({ _id: req.params.folderId, userId: req.userId });
    res.json({ message: "Folder deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Removes the conversation from any other folder first, so it can only ever live in one folder.
conversationRouter.post("/folders/:folderId/add", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { conversationId } = req.body;
    if (!conversationId) return res.status(400).json({ error: "conversationId is required" });
    await ConversationFolder.updateMany({ userId: req.userId }, { $pull: { conversationIds: conversationId } });
    const folder = await ConversationFolder.findOneAndUpdate(
      { _id: req.params.folderId, userId: req.userId },
      { $addToSet: { conversationIds: conversationId } },
      { new: true }
    );
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    res.json({ folder });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.delete("/folders/:folderId/conversations/:convId", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ConversationFolder.updateOne(
      { _id: req.params.folderId, userId: req.userId },
      { $pull: { conversationIds: req.params.convId } }
    );
    res.json({ message: "Removed from folder" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "20"), 50);
    const offset = Math.max(parseInt((req.query.offset as string) || "0"), 0);

    // aggregate() does not apply Mongoose schema type casting — pass an ObjectId explicitly,
    // otherwise $match against a stored ObjectId field never matches the string from the JWT.
    const userIdObj = new Types.ObjectId(req.userId);
    const [result] = await Conversation.aggregate([
      { $match: { userId: userIdObj } },
      {
        $project: {
          total: { $size: { $ifNull: ["$conversationGroups", []] } },
          conversationGroups: {
            $slice: [
              {
                $sortArray: {
                  input: { $ifNull: ["$conversationGroups", []] },
                  sortBy: { updatedAt: -1 }
                }
              },
              offset,
              limit
            ]
          }
        }
      }
    ]);

    if (!result) {
      // Upsert avoids a race-condition duplicate key error on a user's first login.
      await Conversation.updateOne(
        { userId: req.userId },
        { $setOnInsert: { businessUnit: req.businessUnit, conversationGroups: [] } },
        { upsert: true }
      );
      return res.json({ conversations: [], total: 0, hasMore: false });
    }

    const conversations = result.conversationGroups.map((group: any) => ({
      _id: group._id,
      userId: req.userId,
      title: group.title,
      messages: serializeMessages(group.messages as any[]),
      pinnedMessage: group.pinnedMessage ?? undefined,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }));

    res.json({ conversations, total: result.total, hasMore: result.total > offset + limit });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let userConversations = await Conversation.findOne({ userId: req.userId });

    if (!userConversations) {
      userConversations = new Conversation({
        userId: req.userId,
        businessUnit: req.businessUnit,
        conversationGroups: []
      });
    }

    const newGroup = {
      _id: new Types.ObjectId(),
      title: "New Chat",
      messages: []
    };

    await Conversation.updateOne(
      { userId: req.userId },
      { $push: { conversationGroups: newGroup } },
      { upsert: true }
    );

    const conversation = {
      _id: newGroup._id,
      userId: req.userId,
      title: newGroup.title,
      messages: newGroup.messages,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.status(201).json({ conversation });
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const userConversations = await Conversation.findOne({ userId: req.userId });
    if (!userConversations) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const group = userConversations.conversationGroups.find(
      (g) => g._id.toString() === id
    );
    if (!group) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (ensureMessageIds(group)) {
      await userConversations.save();
    }

    const conversation = {
      _id: group._id,
      userId: req.userId,
      title: group.title,
      messages: serializeMessages(group.messages as any[]),
      pinnedMessage: (group as any).pinnedMessage ?? undefined,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    const isCollaborative = !!(await getCollaborationRoomId(id));

    res.json({ conversation, isCollaborative });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /api/v1/conversations/:id/typing — heartbeat while the user is typing in a group chat. */
conversationRouter.post("/:id/typing", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const roomId = await getCollaborationRoomId(id);
    if (!roomId) return res.json({ ok: true });

    const allowed = await isCollaborationParticipant(id, userId);
    if (!allowed) return res.status(403).json({ error: "Not a participant in this conversation" });

    const name = req.fullName || req.email || "Someone";
    await setTypingIndicator(roomId, userId, name);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /api/v1/conversations/:id/typing — clear typing state on blur/send. */
conversationRouter.delete("/:id/typing", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const roomId = await getCollaborationRoomId(id);
    if (!roomId) return res.json({ ok: true });

    await clearTypingIndicator(roomId, userId);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/** GET /api/v1/conversations/:id/typing — who else is currently typing. */
conversationRouter.get("/:id/typing", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const roomId = await getCollaborationRoomId(id);
    if (!roomId) return res.json({ typers: [] });

    const allowed = await isCollaborationParticipant(id, userId);
    if (!allowed) return res.status(403).json({ error: "Not a participant in this conversation" });

    const typers = await getTypingUsers(roomId, userId);
    return res.json({ typers });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.delete("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const userConversations = await Conversation.findOne({ userId: req.userId });
    if (!userConversations) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const exists = userConversations.conversationGroups.some(
      (g) => g._id.toString() === id
    );
    if (!exists) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    await Conversation.updateOne(
      { userId: req.userId },
      { $pull: { conversationGroups: { _id: new Types.ObjectId(id) } } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.post("/:id/note", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const isMultipart = req.headers["content-type"]?.includes("multipart/form-data");

    if (isMultipart) {
      try {
        await runMulter(req, res);
      } catch (multerErr: any) {
        if (multerErr instanceof multer.MulterError || multerErr.message) {
          return res.status(400).json({ error: multerErr.message });
        }
        throw multerErr;
      }
    }

    const content: string = (req.body.content || req.body.message || "").trim();
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];
    const imageFiles = uploadedFiles.filter((f) => IMAGE_MIME_TYPES.includes(f.mimetype));

    if (!content && imageFiles.length === 0) {
      return res.status(400).json({ error: "content or image is required" });
    }

    let replyTo: ChatMessage["replyTo"];
    if (req.body.replyTo) {
      try {
        const parsed = typeof req.body.replyTo === "string" ? JSON.parse(req.body.replyTo) : req.body.replyTo;
        if (parsed?.messageId && parsed?.content) {
          replyTo = {
            messageId: parsed.messageId,
            senderName: parsed.senderName,
            content: String(parsed.content).slice(0, 500),
          };
        }
      } catch { /* ignore malformed replyTo */ }
    }

    const userConvs = await Conversation.findOne({ userId: req.userId });
    if (!userConvs) return res.status(404).json({ error: "Conversation not found" });

    const group = userConvs.conversationGroups.find(g => g._id.toString() === id);
    if (!group) return res.status(404).json({ error: "Conversation not found" });

    let persistedImageUrls: string[] = [];
    if (imageFiles.length > 0) {
      const results = await Promise.allSettled(
        imageFiles.map((f) =>
          uploadChatImage(f.buffer, f.originalname || "image", String(req.userId), f.mimetype)
        )
      );
      persistedImageUrls = results
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof uploadChatImage>>> => r.status === "fulfilled")
        .map((r) => r.value.secureUrl);
    }

    const noteMsg: ChatMessage = {
      role: "user",
      content: content || (persistedImageUrls.length > 0 ? "📷 Photo" : ""),
      timestamp: new Date(),
      senderId: String(req.userId),
      senderName: req.fullName || req.email || "User",
      messageId: typeof req.body.messageId === "string" && req.body.messageId ? req.body.messageId : randomUUID(),
      ...(persistedImageUrls.length > 0 ? { imageUrls: persistedImageUrls } : {}),
      ...(replyTo ? { replyTo } : {}),
    };
    group.messages.push(noteMsg as any);
    group.updatedAt = new Date();
    await userConvs.save();
    syncToCollaborators(id, [noteMsg]);

    res.json({
      conversation: {
        _id: group._id,
        title: group.title,
        messages: serializeMessages(group.messages as any[]),
        pinnedMessage: (group as any).pinnedMessage ?? undefined,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

/** POST /api/v1/conversations/:id/messages/:messageId/reactions */
conversationRouter.post(
  "/:id/messages/:messageId/reactions",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id, messageId } = req.params;
      const emoji = typeof req.body.emoji === "string" ? req.body.emoji.trim() : "";
      if (!emoji) return res.status(400).json({ error: "emoji is required" });

      const userConvs = await Conversation.findOne({ userId: req.userId });
      if (!userConvs) return res.status(404).json({ error: "Conversation not found" });

      const group = userConvs.conversationGroups.find((g) => g._id.toString() === id);
      if (!group) return res.status(404).json({ error: "Conversation not found" });

      ensureMessageIds(group);

      const msg = group.messages.find((m) => m.messageId === messageId);
      if (!msg) return res.status(404).json({ error: "Message not found" });

      const userName = req.fullName || req.email || "User";
      const reactions = [...(msg.reactions || [])];
      const existingIdx = reactions.findIndex((r) => r.userId === String(req.userId));
      if (existingIdx >= 0) {
        if (reactions[existingIdx].emoji === emoji) {
          reactions.splice(existingIdx, 1);
        } else {
          reactions[existingIdx] = { userId: String(req.userId), userName, emoji };
        }
      } else {
        reactions.push({ userId: String(req.userId), userName, emoji });
      }

      msg.reactions = reactions.length > 0 ? reactions : undefined;
      group.updatedAt = new Date();
      await userConvs.save();
      syncReactionToCollaborators(id, messageId, msg.reactions ?? []);

      res.json({
        conversation: {
          _id: group._id,
          title: group.title,
          messages: serializeMessages(group.messages as any[]),
          pinnedMessage: (group as any).pinnedMessage ?? undefined,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt,
        },
      });
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/** POST /api/v1/conversations/:id/pin — pin a message to the top of a group chat. */
conversationRouter.post("/:id/pin", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const messageId = typeof req.body.messageId === "string" ? req.body.messageId : "";
    if (!messageId) return res.status(400).json({ error: "messageId is required" });

    const userConvs = await Conversation.findOne({ userId: req.userId });
    if (!userConvs) return res.status(404).json({ error: "Conversation not found" });

    const group = userConvs.conversationGroups.find((g) => g._id.toString() === id);
    if (!group) return res.status(404).json({ error: "Conversation not found" });

    ensureMessageIds(group);

    const msg = group.messages.find((m) => m.messageId === messageId);
    if (!msg) return res.status(404).json({ error: "Message not found" });

    const pinnedMessage = {
      messageId,
      content: msg.content.slice(0, 200),
      senderName: msg.senderName,
      pinnedBy: req.fullName || req.email || "User",
      pinnedAt: new Date(),
    };
    (group as any).pinnedMessage = pinnedMessage;
    group.updatedAt = new Date();
    await userConvs.save();
    syncPinnedMessageToCollaborators(id, pinnedMessage);

    res.json({
      conversation: {
        _id: group._id,
        title: group.title,
        messages: serializeMessages(group.messages as any[]),
        pinnedMessage,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

/** DELETE /api/v1/conversations/:id/pin — unpin the group message. */
conversationRouter.delete("/:id/pin", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const userConvs = await Conversation.findOne({ userId: req.userId });
    if (!userConvs) return res.status(404).json({ error: "Conversation not found" });

    const group = userConvs.conversationGroups.find((g) => g._id.toString() === id);
    if (!group) return res.status(404).json({ error: "Conversation not found" });

    group.set("pinnedMessage", undefined);
    group.updatedAt = new Date();
    userConvs.markModified("conversationGroups");
    await userConvs.save();
    await syncPinnedMessageToCollaborators(id, null);

    res.json({
      conversation: {
        _id: group._id,
        title: group.title,
        messages: serializeMessages(group.messages as any[]),
        pinnedMessage: undefined,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      },
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.put("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const userConversations = await Conversation.findOne({ userId: req.userId });
    if (!userConversations) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const group = userConversations.conversationGroups.find(
      (g) => g._id.toString() === id
    );
    if (!group) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    group.title = title.trim();
    group.updatedAt = new Date();
    await userConversations.save();

    const conversation = {
      _id: group._id,
      userId: req.userId,
      title: group.title,
      messages: serializeMessages(group.messages as any[]),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    res.json({ conversation });
  } catch (error) {
    console.error("Update conversation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Accepts multipart/form-data OR application/json.
 *
 * Multipart fields:
 *   - message  (string, required) — the user's text message
 *   - files    (file[], optional) — up to MAX_FILES_PER_REQUEST files
 *
 * JSON body (backward-compatible):
 *   - content  (string, required)
 */
conversationRouter.post("/:id/message", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: chatSessionId } = req.params;
    const userId = req.userId!;
    const businessUnit = req.businessUnit!;

    try {
      await runMulter(req, res);
    } catch (multerErr: any) {
      if (multerErr instanceof multer.MulterError || multerErr.message) {
        return res.status(400).json({ error: multerErr.message });
      }
      throw multerErr;
    }

    // Supports both multipart (message field) and JSON (content field) for backward compat.
    const content: string = (req.body.message || req.body.content || "").trim();
    const model = parseModel(req.body.model);
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];

    if (!content && uploadedFiles.length === 0) {
      return res.status(400).json({ error: "Message content or file is required" });
    }

    if (uploadedFiles.length > 0) {
      const existingCount = await UserDocument.countDocuments({ userId, chatSessionId });
      if (existingCount + uploadedFiles.length > MAX_FILES_PER_SESSION) {
        return res.status(400).json({
          error: `Session document limit reached (max ${MAX_FILES_PER_SESSION} files per session)`
        });
      }
    }

    const userConversations = await Conversation.findOne({ userId });
    if (!userConversations) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const group = userConversations.conversationGroups.find(
      (g) => g._id.toString() === chatSessionId
    );
    if (!group) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    let uploadedDocs: { fileName: string; status: string; documentId: string }[] = [];
    if (uploadedFiles.length > 0) {
      uploadedDocs = await handleFileUploads(uploadedFiles, userId, chatSessionId, businessUnit);
    }

    if (!content && uploadedFiles.length > 0) {
      const successUploads = uploadedDocs.filter((d) => d.status === "pending");
      const failedUploads = uploadedDocs.filter((d) => d.status === "failed");

      const ackMessage =
        successUploads.length > 0
          ? `✅ Uploaded ${successUploads.length} file(s): ${successUploads.map((d) => `"${d.fileName}"`).join(", ")}. Processing has started — you can ask questions about ${successUploads.length === 1 ? "it" : "them"} once ready (usually within a minute).` +
            (failedUploads.length > 0
              ? `\n\n❌ Failed to upload: ${failedUploads.map((d) => `"${d.fileName}"`).join(", ")}.`
              : "")
          : `❌ All file uploads failed: ${failedUploads.map((d) => `"${d.fileName}"`).join(", ")}.`;

      await userConversations.save();
      return res.json({
        uploadedDocuments: uploadedDocs,
        assistantMessage: { role: "assistant", content: ackMessage, timestamp: new Date() },
        conversation: {
          _id: group._id,
          userId,
          title: group.title,
          messages: serializeMessages(group.messages as any[]),
          createdAt: group.createdAt,
          updatedAt: group.updatedAt
        }
      });
    }

    const userMessage = { role: "user" as const, content, timestamp: new Date() };
    group.messages.push(userMessage);

    const [sessionStatus, hasSessionChunks, globalContext] = await Promise.all([
      getSessionDocumentStatus(userId, chatSessionId),
      hasReadySessionChunks(userId, chatSessionId),
      buildContextForQuery(content, businessUnit, { userId: req.userId, userDepartment: req.department })
    ]);

    if (globalContext.accessDenied && !hasSessionChunks) {
      const deniedMessage = {
        role: "assistant" as const,
        content:
          "You do not have access to the information required to answer this question. Please contact your HR or manager if you believe this is an error.",
        timestamp: new Date()
      };
      group.messages.push(deniedMessage);
      await userConversations.save();
      return res.json({
        userMessage,
        assistantMessage: deniedMessage,
        uploadedDocuments: uploadedDocs,
        conversation: {
          _id: group._id,
          userId,
          title: group.title,
          messages: serializeMessages(group.messages as any[]),
          createdAt: group.createdAt,
          updatedAt: group.updatedAt
        }
      });
    }

    let sessionContextString = "";

    if (hasSessionChunks) {
      const sessionRAG = await retrieveSessionChunks({ query: content, userId, chatSessionId });

      if (sessionRAG.chunks.length > 0) {
        sessionContextString = buildSessionRAGContext(sessionRAG.chunks);
        logger.info("[Conversation] Session RAG hit", {
          userId,
          chatSessionId,
          chunksUsed: sessionRAG.chunks.length
        });
      } else {
        logger.info("[Conversation] Session RAG — no relevant chunks found", {
          userId,
          chatSessionId
        });
      }
    } else if (sessionStatus.totalDocs === 0) {
      logger.info("[Conversation] No session documents — using global context only", {
        userId,
        chatSessionId
      });
    }

    if (!sessionContextString && globalContext.source === "none") {
      logger.info("[Conversation] No context found for query", {
        userId,
        chatSessionId,
        query: content.substring(0, 80)
      });
    }

    const hasGlobalContext = globalContext.source !== "none" && !globalContext.accessDenied;

    let systemPrompt = buildSystemPrompt(
      businessUnit,
      sessionContextString,
      globalContext.hybridContextString,
      sessionStatus.pendingOrProcessing,
      hasGlobalContext,
      globalContext.source,
      model,
      sessionStatus.failed
    );
    systemPrompt += await buildKbInventoryNote(businessUnit, content, req.userId);

    let aiResponse = "";
    try {
      aiResponse = await getGenerateAIResponse(model)(
        content,
        globalContext.policies.map((p: any) => ({
          title: p.title,
          category: p.category,
          content: p.content,
          score: p.score || 0
        })),
        group.messages.map((m) => ({ role: m.role, content: m.content })),
        businessUnit,
        systemPrompt
      );
    } catch (openaiErr) {
      console.error("OpenAI error:", openaiErr);
      aiResponse =
        `### Unable to Process Request\n\n` +
        `I apologize, but I'm having trouble processing your request right now.\n\n` +
        `**Next Steps:**\n` +
        `• Please try again in a moment\n` +
        `• If the problem persists, contact HR & Compliance directly\n` +
        `• Your question: *${content}*`;
    }

    const assistantMessage = { role: "assistant" as const, content: aiResponse, timestamp: new Date() };
    group.messages.push(assistantMessage);

    if (group.messages.length === 2) {
      try {
        group.title = await generateConversationTitle(content);
      } catch {
        const firstUserContent = content.substring(0, 50);
        group.title = firstUserContent.length === 50 ? firstUserContent + "..." : firstUserContent;
      }
    }

    await userConversations.save();

    const conversation = {
      _id: group._id,
      userId,
      title: group.title,
      messages: serializeMessages(group.messages as any[]),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    res.json({ userMessage, assistantMessage, uploadedDocuments: uploadedDocs, conversation });
  } catch (error) {
    console.error("Add message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

conversationRouter.post("/:id/message/:index/edit", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, index } = req.params;
    const { content } = req.body;
    const messageIndex = parseInt(index, 10);

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    const userConversations = await Conversation.findOne({ userId: req.userId });
    if (!userConversations) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const group = userConversations.conversationGroups.find(
      (g) => g._id.toString() === id
    );
    if (!group) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (messageIndex < 0 || messageIndex >= group.messages.length) {
      return res.status(400).json({ error: "Invalid message index" });
    }

    const message = group.messages[messageIndex];
    if (message.role !== "user") {
      return res.status(400).json({ error: "Can only edit user messages" });
    }

    group.messages.splice(messageIndex, 1);
    if (messageIndex < group.messages.length && group.messages[messageIndex].role === "assistant") {
      group.messages.splice(messageIndex, 1);
    }

    const editedMessage = { role: "user" as const, content: content.trim(), timestamp: new Date() };
    group.messages.splice(messageIndex, 0, editedMessage);

    const businessUnit = req.businessUnit!;
    const userId = req.userId!;
    const chatSessionId = id;
    const model = parseModel(req.body.model);

    const [sessionStatus, hasSessionChunks, globalContext] = await Promise.all([
      getSessionDocumentStatus(userId, chatSessionId),
      hasReadySessionChunks(userId, chatSessionId),
      buildContextForQuery(content, businessUnit, { userId: req.userId, userDepartment: req.department })
    ]);

    if (globalContext.accessDenied && !hasSessionChunks) {
      const deniedMessage = {
        role: "assistant" as const,
        content:
          "You do not have access to the information required to answer this question. Please contact your HR or manager if you believe this is an error.",
        timestamp: new Date()
      };
      group.messages.push(deniedMessage);
      await userConversations.save();
      return res.json({
        userMessage: editedMessage,
        assistantMessage: deniedMessage,
        conversation: {
          _id: group._id,
          userId,
          title: group.title,
          messages: serializeMessages(group.messages as any[]),
          createdAt: group.createdAt,
          updatedAt: group.updatedAt
        }
      });
    }

    let sessionContextString = "";
    if (hasSessionChunks) {
      const sessionRAG = await retrieveSessionChunks({ query: content, userId, chatSessionId });
      if (sessionRAG.chunks.length > 0) {
        sessionContextString = buildSessionRAGContext(sessionRAG.chunks);
      }
    }

    const hasGlobalContext = globalContext.source !== "none" && !globalContext.accessDenied;
    let systemPrompt = buildSystemPrompt(
      businessUnit,
      sessionContextString,
      globalContext.hybridContextString,
      sessionStatus.pendingOrProcessing,
      hasGlobalContext,
      globalContext.source,
      model,
      sessionStatus.failed
    );
    systemPrompt += await buildKbInventoryNote(businessUnit, content, req.userId);

    let aiResponse = "";
    try {
      aiResponse = await getGenerateAIResponse(model)(
        content,
        globalContext.policies.map((p: any) => ({
          title: p.title,
          category: p.category,
          content: p.content,
          score: p.score || 0
        })),
        group.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        businessUnit,
        systemPrompt
      );
    } catch (error) {
      console.error("OpenAI error:", error);
      aiResponse =
        `### Unable to Process Request\n\n` +
        `I apologize, but I'm having trouble processing your request right now.\n\n` +
        `**Next Steps:**\n` +
        `• Please try again in a moment\n` +
        `• If the problem persists, contact HR & Compliance directly\n` +
        `• Your question: *${content}*`;
    }

    const assistantMessage = { role: "assistant" as const, content: aiResponse, timestamp: new Date() };
    group.messages.push(assistantMessage);

    await userConversations.save();

    const conversation = {
      _id: group._id,
      userId,
      title: group.title,
      messages: serializeMessages(group.messages as any[]),
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    res.json({ userMessage: editedMessage, assistantMessage, conversation });
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Accepts multipart/form-data OR application/json.
 * Same contract as /:id/message but streams the AI response via Server-Sent Events.
 */
conversationRouter.post("/:id/message-stream", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: chatSessionId } = req.params;
    const userId = req.userId!;
    const businessUnit = req.businessUnit!;
    const t = { start: Date.now(), cloudinaryMs: 0, dbMs: 0, contextMs: 0, ttftMs: 0, streamMs: 0 };

    try {
      await runMulter(req, res);
    } catch (multerErr: any) {
      if (multerErr instanceof multer.MulterError || multerErr.message) {
        return res.status(400).json({ error: multerErr.message });
      }
      throw multerErr;
    }

    const content: string = (req.body.message || req.body.content || "").trim();
    const model = parseModel(req.body.model);
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];

    if (!content && uploadedFiles.length === 0) {
      return res.status(400).json({ error: "Message content or file is required" });
    }

    // Detect here, but do NOT start generating yet. Generation used to be kicked off at
    // this point "to run in parallel", which meant it only ever saw the user's sentence —
    // an upload plus "turn this into a PDF" produced a document *about turning things into
    // PDFs*, because the source document had not been extracted yet. It is started further
    // down, once the uploaded/session document text is available.
    const docRequest = content ? detectDocumentRequest(content) : null;
    let documentGenPromise: Promise<GeneratedDocResult | null> | null = null;

    const imageFiles = uploadedFiles.filter(f => IMAGE_MIME_TYPES.includes(f.mimetype));
    const documentFiles = uploadedFiles.filter(f => !IMAGE_MIME_TYPES.includes(f.mimetype));

    if (documentFiles.length > 0) {
      const existingCount = await UserDocument.countDocuments({ userId, chatSessionId });
      if (existingCount + documentFiles.length > MAX_FILES_PER_SESSION) {
        return res.status(400).json({
          error: `Session document limit reached (max ${MAX_FILES_PER_SESSION} files per session)`
        });
      }
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    // Images go to the model as in-memory base64 (zero latency). The Cloudinary upload below
    // is persistence-only (needed for follow-up turns) and runs in parallel, off the critical path.
    const imageAttachments: ImageAttachment[] = imageFiles.map(f => ({
      base64: f.buffer.toString("base64"),
      mimeType: f.mimetype
    }));

    const parallelStart = Date.now();
    const [cloudinaryResults, userConversations] = await Promise.all([
      imageFiles.length > 0
        ? Promise.allSettled(
            imageFiles.map((f) => uploadChatImage(f.buffer, f.originalname || "image", userId, f.mimetype))
          )
        : Promise.resolve([] as PromiseSettledResult<{ secureUrl: string }>[]),
      Conversation.findOne(
        { userId, "conversationGroups._id": new Types.ObjectId(chatSessionId) },
        { "conversationGroups.$": 1 }
      )
    ]);
    t.cloudinaryMs = imageFiles.length > 0 ? Date.now() - parallelStart : 0;
    t.dbMs = Date.now() - parallelStart;

    let persistedImageUrls: string[] = [];
    if (imageFiles.length > 0) {
      persistedImageUrls = (cloudinaryResults as PromiseSettledResult<{ secureUrl: string }>[])
        .map((u) => (u.status === "fulfilled" ? u.value.secureUrl : null))
        .filter((u): u is string => !!u);
      const failedCount = imageFiles.length - persistedImageUrls.length;
      if (failedCount > 0) {
        logger.warn("[Conversation/Stream] Some chat image uploads failed", {
          userId,
          total: imageFiles.length,
          failed: failedCount
        });
      }
    }

    if (!userConversations) {
      res.write(`data: ${JSON.stringify({ error: "Conversation not found", done: true })}\n\n`);
      res.end();
      return;
    }

    const group = userConversations.conversationGroups[0];
    if (!group) {
      res.write(`data: ${JSON.stringify({ error: "Conversation not found", done: true })}\n\n`);
      res.end();
      return;
    }

    let uploadedDocs: { fileName: string; status: string; documentId: string }[] = [];
    if (documentFiles.length > 0) {
      uploadedDocs = await handleFileUploads(documentFiles, userId, chatSessionId, businessUnit);
    }

    let inlineDocumentText = "";
    const extractionFailedNames: string[] = [];
    const scannedPdfNames: string[] = [];
    const truncatedDocNames: string[] = [];
    if (documentFiles.length > 0) {
      const extractions = await Promise.all(
        documentFiles.map(async (f) => {
          const { text, ok, reason } = await extractTextFromFile(f);
          if (!ok || !text.trim()) {
            if (reason === "scanned_pdf") scannedPdfNames.push(f.originalname);
            else extractionFailedNames.push(f.originalname);
            return "";
          }
          if (text.length <= MAX_INLINE_TEXT_CHARS) {
            return `--- Document: ${f.originalname} (complete) ---\n${text}`;
          }
          // Too long to send in full. Label the excerpt explicitly — an unlabelled
          // truncation is what makes the model answer confidently about pages it
          // never received.
          truncatedDocNames.push(f.originalname);
          const shownPct = Math.max(1, Math.round((MAX_INLINE_TEXT_CHARS / text.length) * 100));
          return (
            `--- Document: ${f.originalname} (PARTIAL — first ${MAX_INLINE_TEXT_CHARS.toLocaleString()} of ` +
            `${text.length.toLocaleString()} characters, roughly the first ${shownPct}% of the document) ---\n` +
            `${text.slice(0, MAX_INLINE_TEXT_CHARS)}\n` +
            `--- END OF EXCERPT for ${f.originalname}. The remaining ~${100 - shownPct}% was NOT given to you. ` +
            `Do not treat this excerpt as the whole document or assume it ends here. If the user asks about ` +
            `anything that could appear later in it, say clearly that you only received the first ~${shownPct}% ` +
            `and ask which section they want. ---`
          );
        })
      );
      inlineDocumentText = extractions.filter(Boolean).join("\n\n");
      if (truncatedDocNames.length > 0) {
        logger.info("[Conversation] Document(s) truncated for inline analysis", {
          userId,
          chatSessionId,
          files: truncatedDocNames,
          limit: MAX_INLINE_TEXT_CHARS,
        });
      }
    }

    const uploadedDocsWithMeta = uploadedDocs.map((d) => ({
      ...d,
      extractionFailed: extractionFailedNames.includes(d.fileName),
    }));

    if (!content && uploadedFiles.length > 0 && !inlineDocumentText && imageAttachments.length === 0) {
      const successUploads = uploadedDocs.filter((d) => d.status === "pending");
      const failedUploads = uploadedDocs.filter((d) => d.status === "failed");

      const ackContent =
        successUploads.length > 0
          ? `✅ Uploaded ${successUploads.length} file(s): ${successUploads.map((d) => `"${d.fileName}"`).join(", ")}. Processing has started — you can ask questions about ${successUploads.length === 1 ? "it" : "them"} once ready (usually within a minute).` +
            (failedUploads.length > 0
              ? `\n\n❌ Failed to upload: ${failedUploads.map((d) => `"${d.fileName}"`).join(", ")}.`
              : "")
          : `❌ All file uploads failed: ${failedUploads.map((d) => `"${d.fileName}"`).join(", ")}.`;

      const conversation = {
        _id: group._id,
        userId,
        title: group.title,
        messages: serializeMessages(group.messages as any[]),
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      };

      res.write(
        `data: ${JSON.stringify({
          done: true,
          fullResponse: ackContent,
          uploadedDocuments: uploadedDocsWithMeta,
          conversation
        })}\n\n`
      );
      res.end();
      return;
    }

    // Persist attached document filenames as a 📎-prefixed line on the stored message so the
    // attachment chip survives in chat history after the optimistic client message is replaced
    // by the saved conversation. Images render from imageUrls, so only document files get a chip.
    // The clean `content`/`aiUserMessage` is what's sent to the model — this label never reaches it
    // (history uses group.messages.slice(0, -1), excluding this message).
    const attachmentLabel =
      documentFiles.length > 0
        ? `${content ? "\n" : ""}📎 ${documentFiles.map((f) => f.originalname).join(", ")}`
        : "";
    const userMessage = {
      role: "user" as const,
      content: content + attachmentLabel,
      timestamp: new Date(),
      messageId: randomUUID(),
      senderId: String(userId),
      senderName: (req as AuthenticatedRequest).fullName || (req as AuthenticatedRequest).email || "User",
      ...(persistedImageUrls.length > 0 ? { imageUrls: persistedImageUrls } : {})
    };
    group.messages.push(userMessage);

    // Simple/conversational queries (greetings, acks) skip the entire RAG pipeline —
    // no embedding generation, no vector search, no keyword search. Cuts TTFT from
    // ~6-7s to under 1s for those messages. Attachments or a doc-generation request
    // always force the full pipeline regardless of content length.
    const ragBypassed =
      !docRequest &&
      uploadedFiles.length === 0 &&
      isSimpleQuery(content);

    type SessionStatusResult = { totalDocs: number; pendingOrProcessing: string[]; ready: number; failed: string[] };
    let sessionStatus: SessionStatusResult = { totalDocs: 0, pendingOrProcessing: [], ready: 0, failed: [] };
    let hasSessionChunks = false;
    let globalContext: Awaited<ReturnType<typeof buildContextForQuery>> = {
      hybridContextString: "", ragChunks: [], policies: [],
      accessDenied: false, source: "none"
    };
    let speculativeSessionRAG: { chunks: { content: string; score: number; fileName: string; chunkIndex: number; documentId: string }[] } = { chunks: [] };

    const contextStart = Date.now();
    if (ragBypassed) {
      logger.info("[Stream/Context] RAG bypassed (simple query)", {
        userId,
        chatSessionId,
        query: content.substring(0, 40),
      });
      res.write(`data: ${JSON.stringify({ status: "Generating response..." })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ status: "Thinking..." })}\n\n`);
      [sessionStatus, hasSessionChunks, globalContext, speculativeSessionRAG] = await Promise.all([
        getSessionDocumentStatus(userId, chatSessionId),
        hasReadySessionChunks(userId, chatSessionId),
        buildContextForQuery(content, businessUnit, { userId: req.userId, userDepartment: req.department }),
        retrieveSessionChunks({ query: content, userId, chatSessionId })
      ]);

      const contextStatusMsg =
        globalContext.source === "rag" ? "Found relevant documents. Generating response..." :
        globalContext.source === "keyword" ? "Found matching policies. Generating response..." :
        "Generating response...";
      res.write(`data: ${JSON.stringify({ status: contextStatusMsg })}\n\n`);
    }
    t.contextMs = Date.now() - contextStart;

    if (globalContext.accessDenied && !hasSessionChunks) {
      const deniedContent =
        "You do not have access to the information required to answer this question. Please contact your HR or manager if you believe this is an error.";
      const deniedMessage = { role: "assistant" as const, content: deniedContent, timestamp: new Date() };
      group.messages.push(deniedMessage);

      const isFirstDenied = group.messages.length === 2;
      await Conversation.updateOne(
        { userId, "conversationGroups._id": new Types.ObjectId(chatSessionId) },
        { $set: { "conversationGroups.$.messages": group.messages } }
      );

      const conversation = {
        _id: group._id, userId, title: group.title, messages: serializeMessages(group.messages as any[]),
        createdAt: group.createdAt, updatedAt: group.updatedAt
      };
      res.write(`data: ${JSON.stringify({ done: true, fullResponse: deniedContent, conversation })}\n\n`);
      res.end();

      if (isFirstDenied) {
        const fallback = content.length > 50 ? content.substring(0, 50) + "..." : content;
        generateConversationTitle(content)
          .catch(() => fallback)
          .then((title) =>
            Conversation.updateOne(
              { userId, "conversationGroups._id": new Types.ObjectId(chatSessionId) },
              { $set: { "conversationGroups.$.title": title } }
            )
          )
          .catch(() => {});
      }
      return;
    }

    let sessionContextString = "";
    // On a turn where the user re-attached the file, inlineDocumentText already carries it.
    // Otherwise prefer the stored verbatim text over top-K chunks: follow-up questions are
    // often holistic ("summarise this", "any risks?") and match no single chunk well.
    if (!inlineDocumentText && hasSessionChunks) {
      const fullDocs = await getSessionDocumentsText(userId, chatSessionId, MAX_INLINE_TEXT_CHARS);
      if (fullDocs.fitsInFull && fullDocs.text) {
        sessionContextString = `📄 DOCUMENTS UPLOADED IN THIS CONVERSATION (full text):\n\n${fullDocs.text}`;
        logger.info("[Conversation/Stream] Session docs served in full", {
          userId,
          chatSessionId,
          files: fullDocs.fileNames,
          chars: fullDocs.text.length
        });
      }
    }

    // Fall back to semantic chunks when the documents are too large to inline, predate the
    // stored-text field, or the user re-attached the file on this turn.
    if (!sessionContextString && hasSessionChunks && speculativeSessionRAG.chunks.length > 0) {
      sessionContextString = buildSessionRAGContext(speculativeSessionRAG.chunks);
      logger.info("[Conversation/Stream] Session RAG hit", {
        userId,
        chatSessionId,
        chunksUsed: speculativeSessionRAG.chunks.length
      });
    }

    // Now that the uploaded document / session context is resolved, start generating the
    // requested file with that material as its source. Runs in parallel with the chat
    // response below, so this still overlaps the streaming turn.
    if (docRequest) {
      const sourceMaterial = [inlineDocumentText, sessionContextString].filter(Boolean).join("\n\n");
      const genPrompt = sourceMaterial
        ? `${content}\n\n=== SOURCE MATERIAL ===\nBase the document entirely on the material below. Reproduce and reorganise its actual content — do NOT write a generic guide about the user's request, and do NOT invent topics that are not present here.\n\n${sourceMaterial}`
        : content;

      logger.info("[DocumentGen] Starting generation", {
        userId,
        documentType: docRequest.type,
        hasSourceMaterial: Boolean(sourceMaterial),
        sourceChars: sourceMaterial.length
      });

      documentGenPromise = generateAndCacheDocument(genPrompt, docRequest.type, model)
        .catch((err) => {
          const msg = err instanceof Error ? err.message : JSON.stringify(err);
          logger.error("[DocumentGen] Generation failed", { userId, documentType: docRequest.type, error: msg });
          return null;
        });
    }

    const hasGlobalContext = globalContext.source !== "none" && !globalContext.accessDenied;
    const failedDocNames = [...new Set([...sessionStatus.failed, ...extractionFailedNames])];
    let systemPrompt = buildSystemPrompt(
      businessUnit,
      sessionContextString,
      globalContext.hybridContextString,
      sessionStatus.pendingOrProcessing,
      hasGlobalContext,
      globalContext.source,
      model,
      failedDocNames,
      scannedPdfNames
    );
    if (docRequest) {
      systemPrompt += `\n\n📎 DOCUMENT GENERATION: The user has requested a ${docRequest.label}. Confirm you are generating it and briefly describe (1–2 sentences) what the file will contain. Do NOT mention a download link — the system will attach it automatically below your message.`;
    }
    systemPrompt += await buildKbInventoryNote(businessUnit, content, req.userId);

    const policyContext = globalContext.policies.map((p: any) => ({
      title: p.title,
      category: p.category,
      content: p.content,
      score: p.score || 0
    }));

    const aiUserMessage = inlineDocumentText
      ? `${content || "Please analyze and summarize the following document(s)."}\n\n${inlineDocumentText}`
      : content;

    let fullResponse = "";
    const webSources: { title: string; link: string }[] = [];
    try {
      const generator = getStreamAIResponse(model)(
        aiUserMessage,
        policyContext,
        group.messages.slice(0, -1).map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.imageUrls && m.imageUrls.length > 0 ? { imageUrls: m.imageUrls } : {})
        })),
        businessUnit,
        systemPrompt,
        imageAttachments.length > 0 ? imageAttachments : undefined,
        webSources
      );

      let firstChunk = true;
      for await (const chunk of generator) {
        if (firstChunk) { t.ttftMs = Date.now() - t.start; firstChunk = false; }
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ chunk, fullResponse })}\n\n`);
      }

      // Build structured source pills for the UI (KB docs + web results).
      let sources: Awaited<ReturnType<typeof buildRagMessageSources>> = [];
      if (globalContext.source === "rag" && globalContext.ragChunks.length > 0) {
        sources = await buildRagMessageSources(globalContext.ragChunks);
      }
      if (webSources.length > 0) {
        sources = [...sources, ...buildWebMessageSources(webSources)];
      }

      let generatedDocument: { url: string; filename: string; documentType: string } | undefined;
      if (documentGenPromise) {
        const docResult = await documentGenPromise;
        if (docResult) generatedDocument = docResult;
      }

      const sanitizedResponse = sanitizeAssistantResponse(fullResponse, {
        hasStructuredSources: sources.length > 0,
      });

      // A download button next to "I wasn't able to generate a response" would be confusing,
      // so only attach the document if the AI actually produced a response.
      const attachDocument = generatedDocument && !!sanitizedResponse;
      const assistantMessage = {
        role: "assistant" as const,
        content: sanitizedResponse || "I wasn't able to generate a response. Please try again.",
        timestamp: new Date(),
        messageId: randomUUID(),
        ...(sources.length > 0 ? { sources } : {}),
        ...(attachDocument ? { generatedDocument } : {})
      };
      group.messages.push(assistantMessage);

      const isFirstMessage = group.messages.length === 2;

      await Conversation.updateOne(
        { userId, "conversationGroups._id": new Types.ObjectId(chatSessionId) },
        { $set: { "conversationGroups.$.messages": group.messages } }
      );

      syncToCollaborators(chatSessionId, [userMessage, assistantMessage]);

      const conversation = {
        _id: group._id,
        userId,
        title: group.title,
        messages: serializeMessages(group.messages as any[]),
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      };

      res.write(
        `data: ${JSON.stringify({
          done: true,
          fullResponse: sanitizedResponse,
          uploadedDocuments: uploadedDocsWithMeta,
          ...(attachDocument ? { generatedDocument } : {}),
          conversation
        })}\n\n`
      );
      res.end();
      t.streamMs = Date.now() - t.start;

      logger.info("[Stream/Perf]", {
        userId,
        chatSessionId,
        businessUnit,
        hasImages: imageFiles.length > 0,
        ragSource: globalContext.source,
        ragBypassed,
        cloudinaryMs: t.cloudinaryMs,
        dbMs: t.dbMs,
        contextMs: t.contextMs,
        ttftMs: t.ttftMs,
        streamMs: t.streamMs
      });

      // Runs after the stream ends so title generation never blocks the client response.
      if (isFirstMessage) {
        const fallback = content.length > 50 ? content.substring(0, 50) + "..." : content;
        generateConversationTitle(content)
          .catch(() => fallback)
          .then((title) =>
            Conversation.updateOne(
              { userId, "conversationGroups._id": new Types.ObjectId(chatSessionId) },
              { $set: { "conversationGroups.$.title": title } }
            )
          )
          .catch(() => {});
      }
    } catch (error) {
      console.error("Stream error:", error);

      // A document may have been successfully cached even if the AI stream itself failed.
      let generatedDocOnError: GeneratedDocResult | undefined;
      if (documentGenPromise) {
        const docResult = await documentGenPromise.catch(() => null);
        if (docResult) generatedDocOnError = docResult;
      }

      if (generatedDocOnError) {
        const fallbackContent = `Your ${generatedDocOnError.documentType.toUpperCase()} has been generated and is ready to download.`;
        const assistantMsg = {
          role: "assistant" as const,
          content: fallbackContent,
          timestamp: new Date(),
          generatedDocument: generatedDocOnError };
        group.messages.push(assistantMsg);
        await Conversation.updateOne(
          { userId, "conversationGroups._id": new Types.ObjectId(chatSessionId) },
          { $set: { "conversationGroups.$.messages": group.messages } }
        ).catch(() => {});
        const conversation = {
          _id: group._id, userId, title: group.title, messages: serializeMessages(group.messages as any[]),
          createdAt: group.createdAt, updatedAt: group.updatedAt
        };
        res.write(`data: ${JSON.stringify({ done: true, fullResponse: fallbackContent, generatedDocument: generatedDocOnError, conversation })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate response", done: true })}\n\n`);
      }
      res.end();
    }
  } catch (error) {
    console.error("Message stream error:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: "Failed to generate response", done: true })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// No auth required — the UUID acts as an unguessable one-time token.
conversationRouter.get("/download-doc/:id", (req, res) => {
  const entry = docCache.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: "Document not found or expired" });
  }
  if (entry.expiresAt < Date.now()) {
    docCache.delete(req.params.id);
    return res.status(410).json({ error: "Download link has expired" });
  }
  res.setHeader("Content-Type", entry.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${entry.filename}"`);
  res.setHeader("Content-Length", entry.buffer.length);
  res.send(entry.buffer);
});
