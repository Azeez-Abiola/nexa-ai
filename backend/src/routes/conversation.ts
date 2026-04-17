import express, { Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { Conversation } from "../models/Conversation";
import { UserDocument } from "../models/UserDocument";
import { RagDocument } from "../models/RagDocument";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import {
  generateAIResponse,
  generateConversationTitle,
  streamAIResponse,
  ImageAttachment
} from "../services/openaiService";
import { buildContextForQuery } from "../utils/contextBuilder";
import { KNOWLEDGE_BASE_VERSIONING_RULES } from "../prompts/knowledgeBaseBehavior";
import { uploadDocument, uploadChatImage } from "../services/cloudinaryService";
import { userDocumentQueue } from "../queue/userDocumentQueue";
import {
  hasReadySessionChunks,
  retrieveSessionChunks,
  buildSessionRAGContext,
  getSessionDocumentStatus
} from "../services/sessionRagService";
import logger from "../utils/logger";
import { extractTextFromPdf } from "../utils/pdfParser";
import { extractTextFromDocx } from "../utils/docxParser";
import { extractTextFromXlsx } from "../utils/xlsxParser";
import { extractTextFromPptx } from "../utils/pptxParser";

export const conversationRouter = express.Router();

// ─── Multer — in-memory, for chat file uploads ────────────────────────────────
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

/**
 * Run multer as a promise so it can be called inside async route handlers
 * and errors can be caught with try/catch.
 */
function runMulter(req: any, res: any): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.array("files", MAX_FILES_PER_REQUEST)(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Upload files to Cloudinary, create UserDocument records, and enqueue processing jobs.
 * Returns the created document records.
 */
async function handleFileUploads(
  files: Express.Multer.File[],
  userId: string,
  chatSessionId: string,
  businessUnit: string
): Promise<{ fileName: string; status: string; documentId: string }[]> {
  const results: { fileName: string; status: string; documentId: string }[] = [];

  for (const file of files) {
    try {
      // Upload to Cloudinary
      const { publicId, secureUrl } = await uploadDocument(
        file.buffer,
        file.originalname,
        `user-uploads/${businessUnit}`,
        file.mimetype
      );

      // Create UserDocument record
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

      // Enqueue async processing job
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
      // Don't throw — partial failure should not block the chat message
      results.push({ fileName: file.originalname, status: "failed", documentId: "" });
    }
  }

  return results;
}

const MAX_INLINE_TEXT_CHARS = 15000;

async function extractTextFromFile(file: Express.Multer.File): Promise<string> {
  try {
    switch (file.mimetype) {
      case "application/pdf":
        return await extractTextFromPdf(file.buffer);
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return await extractTextFromDocx(file.buffer);
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        return extractTextFromXlsx(file.buffer);
      case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        return await extractTextFromPptx(file.buffer);
      case "text/plain":
      case "text/csv":
        return file.buffer.toString("utf-8");
      default:
        return "";
    }
  } catch (err: any) {
    logger.warn("[Conversation] Inline text extraction failed", { fileName: file.originalname, error: err.message });
    return "";
  }
}

/**
 * Build the combined system prompt, injecting session document context and/or
 * global business-unit context depending on what's available.
 */
function buildSystemPrompt(
  businessUnit: string,
  sessionContextString: string,
  globalContextString: string,
  pendingFileNames: string[],
  hasGlobalContext: boolean,
  contextSource: "rag" | "keyword" | "google_only" | "none" = "none"
): string {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const sections: string[] = [
    `You are a helpful AI assistant for ${businessUnit}, a business unit of UACN. Today's date is ${today}.`
  ];

  if (pendingFileNames.length > 0) {
    sections.push(
      `⏳ NOTE: The following document(s) uploaded by the user are still being processed and cannot be queried yet:\n${pendingFileNames.map((f) => `  • ${f}`).join("\n")}\nIf the user asks about these files, let them know processing is in progress and to try again shortly.`
    );
  }

  if (sessionContextString) {
    sections.push(sessionContextString);
  }

  if (globalContextString && hasGlobalContext) {
    // Label the context block for what it actually is. When the source is pure web results, the
    // old "COMPANY KNOWLEDGE BASE" label confused the model into ignoring them for time-sensitive
    // questions and falling back to its training cutoff.
    const isWebOnly = contextSource === "google_only";
    const header = isWebOnly
      ? `🌐 FRESH WEB SEARCH RESULTS (from Google, pulled at request time — these are authoritative for current events, dates, news, sports, prices, and anything time-sensitive):`
      : `📋 COMPANY KNOWLEDGE BASE (general policies & external sources):`;
    sections.push(`${header}\n\n${globalContextString}`);
  }

  sections.push(`INSTRUCTIONS:
1. When answering questions about the user's uploaded documents, use the "YOUR UPLOADED DOCUMENTS" context as your PRIMARY source.
2. For HR policies or general company knowledge, use the "COMPANY KNOWLEDGE BASE" section as your PRIMARY source.
3. **When FRESH WEB SEARCH RESULTS are present in context, they are your source for this answer.** CRITICAL RULES for using them:
   - ONLY state facts that are LITERALLY written in the provided snippets. Do NOT invent, extrapolate, or "fill in" specific details (match times, scores, dates, names, prices) that aren't explicitly stated in the snippets.
   - If the snippets mention a topic but lack specific details the user wants, say: "Based on the search results, [quote what IS there]. For the full details, I'd recommend checking [source name/URL from the snippet]."
   - NEVER fabricate fixture lists, match times, specific scores, or event details by guessing. If the snippet says "Premier League matches tomorrow" but doesn't list the actual matches, say that — don't make up a list.
   - Do NOT add disclaimers like "my knowledge is limited to 2023" or "I can't access the internet" — the web results are right there. Just use them honestly without overpromising on specifics they don't contain.
4. For questions outside all provided sources, answer from your own training knowledge. Only if information may be stale, add a brief "(based on what I know — details may have changed)" note. Never refuse outright.
5. You can perform ANY task: summarization, Q&A, extraction, analysis, transformation, explanation, brainstorming, writing help.
6. If context from uploaded documents is insufficient or missing for a document-specific question, say so honestly — do NOT hallucinate document-specific facts. This only applies to questions ABOUT uploaded documents, not general questions.
7. Only label the source of your answer when it improves clarity:
   - 📄 for user-uploaded document answers
   - 📋 for company knowledge base answers
   - 🌐 for external web sources provided in context
   - No badge for general knowledge / conversational replies.
8. Be professional, helpful, and concise.

${KNOWLEDGE_BASE_VERSIONING_RULES}`);

  return sections.join("\n\n");
}

// ─── Get all conversations ────────────────────────────────────────────────────
conversationRouter.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let userConversations = await Conversation.findOne({ userId: req.userId });

    if (!userConversations) {
      userConversations = new Conversation({
        userId: req.userId,
        businessUnit: req.businessUnit,
        conversationGroups: []
      });
      await userConversations.save();
    }

    const conversations = userConversations.conversationGroups.map((group) => ({
      _id: group._id,
      userId: req.userId,
      title: group.title,
      messages: group.messages,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    }));

    res.json({ conversations });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Create a new conversation ────────────────────────────────────────────────
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
      _id: new (require("mongoose").Types.ObjectId)(),
      title: "New Chat",
      messages: []
    };

    userConversations.conversationGroups.push(newGroup as any);
    await userConversations.save();

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

// ─── Get a specific conversation ─────────────────────────────────────────────
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

    const conversation = {
      _id: group._id,
      userId: req.userId,
      title: group.title,
      messages: group.messages,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    res.json({ conversation });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Delete a conversation ────────────────────────────────────────────────────
conversationRouter.delete("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const userConversations = await Conversation.findOne({ userId: req.userId });
    if (!userConversations) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const indexToDelete = userConversations.conversationGroups.findIndex(
      (g) => g._id.toString() === id
    );
    if (indexToDelete === -1) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    userConversations.conversationGroups.splice(indexToDelete, 1);
    await userConversations.save();

    res.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Update conversation title ────────────────────────────────────────────────
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
      messages: group.messages,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    res.json({ conversation });
  } catch (error) {
    console.error("Update conversation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Add message + optional file upload ──────────────────────────────────────
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

    // Parse multipart if needed — no-op for application/json
    try {
      await runMulter(req, res);
    } catch (multerErr: any) {
      if (multerErr instanceof multer.MulterError || multerErr.message) {
        return res.status(400).json({ error: multerErr.message });
      }
      throw multerErr;
    }

    // Support both multipart (message field) and JSON (content field) for backward compat
    const content: string = (req.body.message || req.body.content || "").trim();
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];

    if (!content && uploadedFiles.length === 0) {
      return res.status(400).json({ error: "Message content or file is required" });
    }

    // ── Session file-count guard ──────────────────────────────────────────────
    if (uploadedFiles.length > 0) {
      const existingCount = await UserDocument.countDocuments({ userId, chatSessionId });
      if (existingCount + uploadedFiles.length > MAX_FILES_PER_SESSION) {
        return res.status(400).json({
          error: `Session document limit reached (max ${MAX_FILES_PER_SESSION} files per session)`
        });
      }
    }

    // ── Load conversation ─────────────────────────────────────────────────────
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

    // ── Upload files (async, non-blocking for chat) ───────────────────────────
    let uploadedDocs: { fileName: string; status: string; documentId: string }[] = [];
    if (uploadedFiles.length > 0) {
      uploadedDocs = await handleFileUploads(uploadedFiles, userId, chatSessionId, businessUnit);
    }

    // If user only uploaded files with no message, acknowledge and return
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
          messages: group.messages,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt
        }
      });
    }

    // ── Push user message ─────────────────────────────────────────────────────
    const userMessage = { role: "user" as const, content, timestamp: new Date() };
    group.messages.push(userMessage);

    // ── Build context: session docs + global ──────────────────────────────────
    const [sessionStatus, hasSessionChunks, globalContext] = await Promise.all([
      getSessionDocumentStatus(userId, chatSessionId),
      hasReadySessionChunks(userId, chatSessionId),
      buildContextForQuery(content, businessUnit, req.grade || "", { userId: req.userId })
    ]);

    // Access denied by global RAG grade restriction
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
          messages: group.messages,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt
        }
      });
    }

    // ── Session RAG retrieval ─────────────────────────────────────────────────
    let sessionContextString = "";
    let sessionChunkCount = 0;

    if (hasSessionChunks) {
      const sessionRAG = await retrieveSessionChunks({ query: content, userId, chatSessionId });
      sessionChunkCount = sessionRAG.chunks.length;

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

    // Log queries with no context at all
    if (!sessionContextString && globalContext.source === "none") {
      logger.info("[Conversation] No context found for query", {
        userId,
        chatSessionId,
        query: content.substring(0, 80)
      });
    }

    // ── Build system prompt ───────────────────────────────────────────────────
    const hasGlobalContext = globalContext.source !== "none" && !globalContext.accessDenied;

    const systemPrompt = buildSystemPrompt(
      businessUnit,
      sessionContextString,
      globalContext.hybridContextString,
      sessionStatus.pendingOrProcessing,
      hasGlobalContext,
      globalContext.source
    );

    // ── Generate AI response ──────────────────────────────────────────────────
    let aiResponse = "";
    try {
      aiResponse = await generateAIResponse(
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

    // Generate title on first exchange
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
      messages: group.messages,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    res.json({ userMessage, assistantMessage, uploadedDocuments: uploadedDocs, conversation });
  } catch (error) {
    console.error("Add message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Edit message and regenerate ─────────────────────────────────────────────
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

    const [sessionStatus, hasSessionChunks, globalContext] = await Promise.all([
      getSessionDocumentStatus(userId, chatSessionId),
      hasReadySessionChunks(userId, chatSessionId),
      buildContextForQuery(content, businessUnit, req.grade || "", { userId: req.userId })
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
          messages: group.messages,
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
    const systemPrompt = buildSystemPrompt(
      businessUnit,
      sessionContextString,
      globalContext.hybridContextString,
      sessionStatus.pendingOrProcessing,
      hasGlobalContext,
      globalContext.source
    );

    let aiResponse = "";
    try {
      aiResponse = await generateAIResponse(
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
      messages: group.messages,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    res.json({ userMessage: editedMessage, assistantMessage, conversation });
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Stream AI response (SSE) ─────────────────────────────────────────────────
/**
 * Accepts multipart/form-data OR application/json.
 * Same contract as /:id/message but streams the AI response via Server-Sent Events.
 */
conversationRouter.post("/:id/message-stream", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: chatSessionId } = req.params;
    const userId = req.userId!;
    const businessUnit = req.businessUnit!;

    // Parse multipart if needed
    try {
      await runMulter(req, res);
    } catch (multerErr: any) {
      if (multerErr instanceof multer.MulterError || multerErr.message) {
        return res.status(400).json({ error: multerErr.message });
      }
      throw multerErr;
    }

    const content: string = (req.body.message || req.body.content || "").trim();
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];

    if (!content && uploadedFiles.length === 0) {
      return res.status(400).json({ error: "Message content or file is required" });
    }

    // ── Separate images from documents ─────────────────────────────────────────
    const imageFiles = uploadedFiles.filter(f => IMAGE_MIME_TYPES.includes(f.mimetype));
    const documentFiles = uploadedFiles.filter(f => !IMAGE_MIME_TYPES.includes(f.mimetype));

    // Session file-count guard (documents only, images are processed inline)
    if (documentFiles.length > 0) {
      const existingCount = await UserDocument.countDocuments({ userId, chatSessionId });
      if (existingCount + documentFiles.length > MAX_FILES_PER_SESSION) {
        return res.status(400).json({
          error: `Session document limit reached (max ${MAX_FILES_PER_SESSION} files per session)`
        });
      }
    }

    // Convert images to base64 for the current turn (fastest path — no round trip to Cloudinary
     // before the model sees them). We separately upload to Cloudinary to get persistent URLs that
     // get stored on the message, so follow-up turns about the same image still work.
    const imageAttachments: ImageAttachment[] = imageFiles.map(f => ({
      base64: f.buffer.toString("base64"),
      mimeType: f.mimetype
    }));

    // Upload images to Cloudinary in parallel; capture URLs for persistence. Failures are tolerated —
    // the current turn still works via base64, we just lose cross-turn memory for that one image.
    let persistedImageUrls: string[] = [];
    if (imageFiles.length > 0) {
      const uploads = await Promise.allSettled(
        imageFiles.map((f) => uploadChatImage(f.buffer, f.originalname || "image", userId, f.mimetype))
      );
      persistedImageUrls = uploads
        .map((u) => (u.status === "fulfilled" ? u.value.secureUrl : null))
        .filter((u): u is string => !!u);
      const failedCount = uploads.length - persistedImageUrls.length;
      if (failedCount > 0) {
        logger.warn("[Conversation/Stream] Some chat image uploads failed", {
          userId,
          total: uploads.length,
          failed: failedCount
        });
      }
    }

    // ── Load conversation ─────────────────────────────────────────────────────
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

    // Upload document files (non-images) for RAG processing
    let uploadedDocs: { fileName: string; status: string; documentId: string }[] = [];
    if (documentFiles.length > 0) {
      uploadedDocs = await handleFileUploads(documentFiles, userId, chatSessionId, businessUnit);
    }

    // ── Extract text from documents inline for immediate AI access ───────────
    let inlineDocumentText = "";
    if (documentFiles.length > 0) {
      const extractions = await Promise.all(
        documentFiles.map(async (f) => {
          const text = await extractTextFromFile(f);
          return text ? `--- Document: ${f.originalname} ---\n${text.slice(0, MAX_INLINE_TEXT_CHARS)}` : "";
        })
      );
      inlineDocumentText = extractions.filter(Boolean).join("\n\n");
    }

    // ── Set up SSE headers early ──────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // File-only upload with no text: auto-summarize the document
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
        messages: group.messages,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      };

      res.write(
        `data: ${JSON.stringify({
          done: true,
          fullResponse: ackContent,
          uploadedDocuments: uploadedDocs,
          conversation
        })}\n\n`
      );
      res.end();
      return;
    }

    // ── Push user message ─────────────────────────────────────────────────────
    const userMessage = {
      role: "user" as const,
      content,
      timestamp: new Date(),
      ...(persistedImageUrls.length > 0 ? { imageUrls: persistedImageUrls } : {})
    };
    group.messages.push(userMessage);

    // ── Build context ─────────────────────────────────────────────────────────
    const [sessionStatus, hasSessionChunks, globalContext] = await Promise.all([
      getSessionDocumentStatus(userId, chatSessionId),
      hasReadySessionChunks(userId, chatSessionId),
      buildContextForQuery(content, businessUnit, req.grade || "", { userId: req.userId })
    ]);

    if (globalContext.accessDenied && !hasSessionChunks) {
      const deniedContent =
        "You do not have access to the information required to answer this question. Please contact your HR or manager if you believe this is an error.";
      const deniedMessage = { role: "assistant" as const, content: deniedContent, timestamp: new Date() };
      group.messages.push(deniedMessage);

      if (group.messages.length === 2) {
        try { group.title = await generateConversationTitle(content); } catch { /* ignore */ }
      }

      await userConversations.save();
      const conversation = {
        _id: group._id, userId, title: group.title, messages: group.messages,
        createdAt: group.createdAt, updatedAt: group.updatedAt
      };
      res.write(`data: ${JSON.stringify({ done: true, fullResponse: deniedContent, conversation })}\n\n`);
      res.end();
      return;
    }

    // ── Session RAG ───────────────────────────────────────────────────────────
    let sessionContextString = "";
    if (hasSessionChunks) {
      const sessionRAG = await retrieveSessionChunks({ query: content, userId, chatSessionId });
      if (sessionRAG.chunks.length > 0) {
        sessionContextString = buildSessionRAGContext(sessionRAG.chunks);
        logger.info("[Conversation/Stream] Session RAG hit", {
          userId,
          chatSessionId,
          chunksUsed: sessionRAG.chunks.length
        });
      }
    }

    const hasGlobalContext = globalContext.source !== "none" && !globalContext.accessDenied;
    const systemPrompt = buildSystemPrompt(
      businessUnit,
      sessionContextString,
      globalContext.hybridContextString,
      sessionStatus.pendingOrProcessing,
      hasGlobalContext,
      globalContext.source
    );

    const policyContext = globalContext.policies.map((p: any) => ({
      title: p.title,
      category: p.category,
      content: p.content,
      score: p.score || 0
    }));

    // ── Stream response ───────────────────────────────────────────────────────
    const aiUserMessage = inlineDocumentText
      ? `${content || "Please analyze and summarize the following document(s)."}\n\n${inlineDocumentText}`
      : content;

    let fullResponse = "";
    try {
      const generator = streamAIResponse(
        aiUserMessage,
        policyContext,
        group.messages.slice(0, -1).map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.imageUrls && m.imageUrls.length > 0 ? { imageUrls: m.imageUrls } : {})
        })),
        businessUnit,
        systemPrompt,
        imageAttachments.length > 0 ? imageAttachments : undefined
      );

      for await (const chunk of generator) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ chunk, fullResponse })}\n\n`);
      }

      // Resolve the cited RAG chunks back to parent documents so the UI can render clickable source pills.
      // De-duplicates by documentId, picks the highest-scoring chunk's metadata, and fetches the file URL.
      let sources: { documentId: string; title: string; documentType: string; version?: number; url?: string }[] = [];
      const chunkByDocId = new Map<string, typeof globalContext.ragChunks[number]>();
      for (const c of globalContext.ragChunks) {
        if (!c.documentId) continue;
        const prev = chunkByDocId.get(c.documentId);
        if (!prev || (prev.score ?? 0) < (c.score ?? 0)) chunkByDocId.set(c.documentId, c);
      }
      if (chunkByDocId.size > 0) {
        const ids = Array.from(chunkByDocId.keys()).filter((id) => mongoose.Types.ObjectId.isValid(id));
        if (ids.length > 0) {
          const docs = await RagDocument.find({ _id: { $in: ids } })
            .select("_id title documentType version cloudinaryUrl")
            .lean();
          const docMap = new Map(docs.map((d: any) => [String(d._id), d]));
          sources = Array.from(chunkByDocId.keys())
            .map((id) => {
              const c = chunkByDocId.get(id)!;
              const d: any = docMap.get(id);
              return {
                documentId: id,
                title: d?.title || c.documentTitle || "Untitled",
                documentType: d?.documentType || c.documentType || "other",
                version: d?.version ?? c.version,
                url: d?.cloudinaryUrl
              };
            });
        }
      }

      const assistantMessage = {
        role: "assistant" as const,
        content: fullResponse,
        timestamp: new Date(),
        ...(sources.length > 0 ? { sources } : {})
      };
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
        messages: group.messages,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      };

      res.write(
        `data: ${JSON.stringify({
          done: true,
          fullResponse,
          uploadedDocuments: uploadedDocs,
          conversation
        })}\n\n`
      );
      res.end();
    } catch (error) {
      console.error("Stream error:", error);
      res.write(`data: ${JSON.stringify({ error: "Failed to generate response", done: true })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error("Message stream error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
