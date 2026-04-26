import express from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { getBusinessUnitLabel, getAllBusinessUnits } from "../config/businessUnits";
import {
  searchGoogle,
  formatSearchResultsForChat
} from "../services/googleSearchService";
import { streamAIResponse } from "../services/openaiService";
import { buildContextForQuery } from "../utils/contextBuilder";

import { RagDocument } from "../models/RagDocument";
import { KnowledgeGroup } from "../models/KnowledgeGroup";
import { Types } from "mongoose";
import logger from "../utils/logger";

export const chatRouter = express.Router();

const TYPE_LABELS: Record<string, string> = {
  policy: "Policy",
  procedure: "S&OP / procedure",
  handbook: "Handbook",
  contract: "Contract",
  report: "Financial reports",
  other: "Other"
};

// Authenticated — suggestions must respect the same access control as retrieval, otherwise
// a user removed from a restricted doc's group could still see that doc as a chip on their home screen.
chatRouter.get("/suggestions", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const bu = String(req.businessUnit || req.query.businessUnit || "").trim();
    if (!bu) return res.status(400).json({ error: "businessUnit is required" });

    const groupOr: Record<string, unknown>[] = [
      { allowedGroupIds: { $exists: false } },
      { allowedGroupIds: { $size: 0 } }
    ];
    if (req.userId && Types.ObjectId.isValid(req.userId)) {
      const uid = new Types.ObjectId(req.userId);
      const groups = await KnowledgeGroup.find({ businessUnit: bu, memberUserIds: uid })
        .select("_id")
        .lean();
      const ids = groups.map((g) => g._id as Types.ObjectId);
      if (ids.length > 0) groupOr.push({ allowedGroupIds: { $in: ids } });
    }

    const docs = await RagDocument.find({
      businessUnit: bu,
      isLatestVersion: true,
      processingStatus: "completed",
      $or: groupOr
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .select("title documentType")
      .lean();

    const suggestions = docs.map((d: { title: string; documentType: string }) => ({
      title: d.title,
      category: TYPE_LABELS[d.documentType] || d.documentType,
      prompt: `Tell me about ${d.title}`
    }));

    // No dummy defaults: if the user has no KB access (or the BU has uploaded nothing),
    // return an empty list so the home screen stays clean rather than advertising docs they can't use.
    res.json({ suggestions });
  } catch (error) {
    console.error("Get suggestions error stack:", error);
    logger.error("Get suggestions error", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Simple in-memory per-BU rate limiter: max 30 requests per minute per business unit
const buRateLimiter = (() => {
  const counts = new Map<string, { count: number; resetAt: number }>();
  const WINDOW_MS = 60_000;
  const MAX_REQUESTS = 30;

  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    const key = req.businessUnit || req.ip || "unknown";
    const now = Date.now();
    const entry = counts.get(key);

    if (!entry || now >= entry.resetAt) {
      counts.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return next();
    }

    entry.count += 1;
    if (entry.count > MAX_REQUESTS) {
      return res.status(429).json({ error: "Too many requests. Please wait a moment before sending another message." });
    }

    next();
  };
})();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPEN_AI_MODEL || "gpt-4o-mini";

// Greeting patterns
const GREETING_PATTERNS = [
  /^(hello|hi|hey|greetings|good morning|good afternoon|good evening|sup|howdy|yo)\b/i,
  /\b(hello|hi|hey|greetings|good morning|good afternoon|good evening|sup|howdy|yo)\s*[,!?]?\s*$/i,
  /^(how are you|how's it going|how do you do)\b/i
];


// Function to detect if message is a greeting
const isGreeting = (message: string): boolean => {
  const trimmed = message.trim();
  return GREETING_PATTERNS.some((pattern) => pattern.test(trimmed));
};


// Greeting responses
const getGreetingResponse = async (businessUnit: string): Promise<string> => {
  const buName = await getBusinessUnitLabel(businessUnit);
  const greetings = [
    `👋 Hello! Welcome to Nexa AI. I'm here to help with ${buName} policies and information. What can I assist you with today?`,
    `Hey there! 👋 I'm Nexa AI, your ${buName} policy assistant. Feel free to ask me about any company policies or guidelines.`,
    `Good to see you! 👋 I can help you find information about ${buName} policies, benefits, work guidelines, and more. What would you like to know?`
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
};

// Call OpenAI API
async function callOpenAIAPI(systemPrompt: string, userMessage: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 1024,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || "Unknown error"}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Apply auth + per-BU rate limiting to authenticated chat
chatRouter.post("/", authMiddleware, buRateLimiter, async (req: AuthenticatedRequest, res) => {
  const { messages } = req.body as { messages: ChatMessage[] };
  const businessUnit = req.businessUnit;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  if (!businessUnit) {
    return res.status(400).json({ error: "Business unit not found in token" });
  }

  try {
    const userMessage = messages[messages.length - 1]?.content || "";

    // Check if it's a greeting
    if (isGreeting(userMessage)) {
      return res.json({
        reply: await getGreetingResponse(businessUnit)
      });
    }

    const buName = await getBusinessUnitLabel(businessUnit);
    const buAbbr = businessUnit;

    // Build context: RAG first, keyword fallback, Google in parallel
    const context = await buildContextForQuery(userMessage, businessUnit, {
      userId: req.userId
    });

    if (context.accessDenied) {
      return res.json({
        reply: "You do not have access to the information required to answer this question. Please contact your HR or manager if you believe this is an error."
      });
    }

    const hasContext = context.source !== "none";
    const hasExternalSources = context.googleResults.length > 0;

    if (hasContext) {
      const systemPrompt = `You are a helpful assistant for ${buName} (${buAbbr}), a business unit of UACN.

You have been provided with information from company documents and/or external sources:

${context.hybridContextString}

IMPORTANT INSTRUCTIONS:
1. Prioritize company documents (📋) when answering questions - they are the official source of truth
2. Use external sources (🌐) to provide additional context, best practices, or industry standards
3. Clearly indicate which source you're referencing
4. If company documents conflict with external sources, follow company documents
5. Format responses clearly with bullet points and headers where appropriate
6. Be professional, helpful, and concise
7. Direct users to HR & Compliance for policy clarifications or disputes`;

      try {
        const reply = await callOpenAIAPI(systemPrompt, userMessage);
        let finalReply = reply;
        if (hasExternalSources) {
          finalReply += context.googleFooter;
          finalReply += "\n\n💡 **Note:** External sources complement company documents but company documents take precedence.";
        }
        return res.json({ reply: finalReply });
      } catch (error) {
        // Fallback: render context directly
        let response = context.hybridContextString;
        if (hasExternalSources) response += "\n\n" + context.googleFooter;
        response += `\n\n**Need More Help?**\n• Contact HR & Compliance for policy questions`;
        return res.json({ reply: response });
      }
    }

    // No context found
    const noMatchSystemPrompt = `You are a helpful assistant for ${buName} (${buAbbr}), a business unit of UACN.

The user asked a question that doesn't have specific information in company documents OR external sources.

Politely explain that you couldn't find relevant information and direct them to HR & Compliance.
Be helpful and professional.`;

    try {
      const reply = await callOpenAIAPI(noMatchSystemPrompt, userMessage);
      return res.json({ reply });
    } catch (error) {
      return res.json({
        reply:
          `### No Information Found\n\n` +
          `You asked about: *${userMessage}*\n\n` +
          `**Suggestions:**\n` +
          `• Try rephrasing your question with different keywords\n` +
          `• Ask about specific topics: leave, salary, benefits, work hours, training, code of conduct\n` +
          `• Contact HR & Compliance directly for detailed information\n\n` +
          `How can I help you further?`
      });
    }
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Public chat endpoint - no authentication required (for landing page chatbot)
chatRouter.post("/public", async (req, res) => {
  const { messages } = req.body as { messages: ChatMessage[] };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  try {
    const userMessage = messages[messages.length - 1]?.content || "";
    
    console.log(`[Chat/Public] ========== NEW REQUEST ==========`);
    console.log(`[Chat/Public] User message: "${userMessage}"`);

    // Search for relevant information from Google (hybrid approach for public)
    console.log(`[Chat/Public] Starting Google search...`);
    const googleResults = await searchGoogle(userMessage, 3);
    
    console.log(`[Chat/Public] Google search complete:`, googleResults.success ? `✓ ${googleResults.results?.length || 0} results` : `✗ Error: ${googleResults.error}`);

    const allBUs = await getAllBusinessUnits();
    const businessUnitsList = allBUs.map(bu => `- ${bu.label}`).join("\n");

    // System prompt for public chatbot with Google context
    let systemPrompt = `You are a friendly and helpful assistant for UACN (United African Capital Limited).

UACN is a conglomerate with several business units including:
${businessUnitsList}

About UACN:
- It's one of Nigeria's largest and oldest diversified business conglomerates
- Founded with a strong legacy of entrepreneurship and innovation
- Operates across multiple sectors of the Nigerian economy
- Committed to creating sustainable value for stakeholders`;

    // Add external sources context if available
    if (googleResults.success && googleResults.results && googleResults.results.length > 0) {
      const externalContext = googleResults.results
        .map((r, i) => `[${i + 1}] ${r.title}: ${r.snippet} (${r.link})`)
        .join("\n");
      
      systemPrompt += `\n\nEXTERNAL SOURCES (from Google):
${externalContext}`;
    }

    systemPrompt += `

Your role:
1. Provide helpful information about UACN and its business units
2. Answer general questions about UACN's operations, history, and services
3. Use external sources to supplement your responses when relevant
4. Guide visitors to appropriate business units for specific services
5. Be professional, friendly, and informative
6. If asked about specific employee policies or confidential information, direct them to contact HR or the relevant department
7. Encourage users to log in for more detailed policy information and personalized assistance

Always maintain a professional tone and be helpful to potential customers, investors, and visitors.`;

    try {
      const reply = await callOpenAIAPI(systemPrompt, userMessage);
      
      // Append external sources footer if available
      let finalReply = reply;
      if (googleResults.success && googleResults.results && googleResults.results.length > 0) {
        const externalSourcesFooter = formatSearchResultsForChat(googleResults.results);
        finalReply += externalSourcesFooter;
      }
      
      console.log(`[Chat/Public] Sending response`);
      return res.json({ reply: finalReply });
    } catch (error) {
      console.error("[Chat/Public] OpenAI error:", error);
      return res.json({
        reply:
          "Hello! 👋 I'm the UACN assistant. I'm having a temporary issue, but I'd be happy to help!\n\n" +
          "You asked about: *" +
          userMessage +
          "*\n\n" +
          "Feel free to try rephrasing your question, or you can:\n" +
          "• **Log in** to access detailed company policies and information\n" +
          "• **Contact us** directly at info@uacn.com\n" +
          "• **Visit** our websites for more information about UACN and its business units\n\n" +
          "How else can I assist you?"
      });
    }
  } catch (error) {
    console.error("[Chat/Public] Unhandled error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Streaming chat endpoint - for real-time response display
// Sends response as Server-Sent Events (SSE) as it's generated by OpenAI
chatRouter.post("/public/stream", async (req, res) => {
  const { messages } = req.body as { messages: ChatMessage[] };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  try {
    const userMessage = messages[messages.length - 1]?.content || "";
    
    console.log(`[Chat/Stream] New streaming request: "${userMessage.substring(0, 50)}..."`);

    // Set up SSE headers - enable streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Build minimal system prompt for speed
    // Public endpoint: no BU-scoped policy search — unauthenticated callers must not
    // be able to query internal documents by passing an arbitrary businessUnit in the body.
    const systemPrompt = `You are Nexa AI, a helpful assistant for the UACN Group. Keep responses concise and well-formatted. For detailed policy information, direct users to log in.`;

    // Stream response from OpenAI
    try {
      const stream = streamAIResponse(
        userMessage,
        [], // no internal policies for unauthenticated public stream
        messages.filter(m => m.role !== "system"),
        "",
        systemPrompt
      );

      // Send each chunk as it arrives
      let fullResponse = "";
      for await (const chunk of stream) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({
          type: "chunk",
          content: chunk
        })}\n\n`);
      }

      // Send completion signal
      res.write(`data: ${JSON.stringify({
        type: "done",
        content: ""
      })}\n\n`);
      
      console.log(`[Chat/Stream] Stream completed (${fullResponse.length} chars)`);
      res.end();
    } catch (streamError) {
      console.error(`[Chat/Stream] Streaming error:`, streamError);
      res.write(`data: ${JSON.stringify({
        type: "error",
        content: "Sorry, I encountered an error generating the response. Please try again."
      })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error("[Chat/Stream] Request error:", error);
    res.write(`data: ${JSON.stringify({
      type: "error",
      content: "An error occurred. Please try again."
    })}\n\n`);
    res.end();
  }
});


