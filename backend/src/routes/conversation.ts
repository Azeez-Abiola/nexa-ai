import express, { Response } from "express";
import { Conversation } from "../models/Conversation";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { generateAIResponse, generateConversationTitle, streamAIResponse } from "../services/openaiService";
import { buildContextForQuery } from "../utils/contextBuilder";

export const conversationRouter = express.Router();


// Get all conversations for a user (returns conversationGroups from the single user document)
conversationRouter.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let userConversations = await Conversation.findOne({ userId: req.userId });

    // If user has no document yet, create one
    if (!userConversations) {
      userConversations = new Conversation({
        userId: req.userId,
        businessUnit: req.businessUnit,
        conversationGroups: []
      });
      await userConversations.save();
    }

    // Map conversationGroups as separate conversation objects for frontend
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

// Create a new conversation group within the user's single document
conversationRouter.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let userConversations = await Conversation.findOne({ userId: req.userId });

    // If user document doesn't exist, create it
    if (!userConversations) {
      userConversations = new Conversation({
        userId: req.userId,
        businessUnit: req.businessUnit,
        conversationGroups: []
      });
    }

    // Create new conversation group
    const newGroup = {
      _id: new (require("mongoose").Types.ObjectId)(),
      title: "New Chat",
      messages: []
    };

    userConversations.conversationGroups.push(newGroup as any);
    await userConversations.save();

    // Return as a conversation object for frontend
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

// Get a specific conversation group by ID
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

// Delete a conversation group
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

// Update conversation title
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

    // Return updated conversation
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

// Add message to conversation group and get AI response
conversationRouter.post("/:id/message", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

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

    const userMessage = { role: "user" as const, content: content.trim(), timestamp: new Date() };
    group.messages.push(userMessage);

    // Generate AI response using OpenAI
    let aiResponse = "";

    const businessUnit = req.businessUnit;
    const context = await buildContextForQuery(content, businessUnit!, req.grade || "");

    if (context.accessDenied) {
      const deniedMessage = { role: "assistant" as const, content: "You do not have access to the information required to answer this question. Please contact your HR or manager if you believe this is an error.", timestamp: new Date() };
      group.messages.push(deniedMessage);
      await userConversations.save();
      const conversation = { _id: group._id, userId: req.userId, title: group.title, messages: group.messages, createdAt: group.createdAt, updatedAt: group.updatedAt };
      return res.json({ userMessage, assistantMessage: deniedMessage, conversation });
    }

    const hasContext = context.source !== "none";

    try {
      let systemPrompt = hasContext
        ? `You are a helpful assistant for ${businessUnit}, a business unit of UACN.

You have been provided with information from company documents and/or external sources:

${context.hybridContextString}

IMPORTANT INSTRUCTIONS:
1. Prioritize company documents (📋) when answering - they are the official source of truth
2. Use external sources (🌐) for additional context and best practices
3. Clearly indicate which source you're referencing
4. Format responses clearly with bullet points and headers where appropriate
5. Be professional, helpful, and concise
6. Direct users to HR & Compliance for policy clarifications or disputes`
        : `You are a helpful assistant for ${businessUnit}, a business unit of UACN.

The user asked a question that doesn't have specific information in company documents OR external sources.

Politely explain that you couldn't find relevant information and direct them to HR & Compliance.
Be helpful and professional.`;

      aiResponse = await generateAIResponse(
        content,
        context.policies.map((p: any) => ({ title: p.title, category: p.category, content: p.content, score: p.score || 0 })),
        group.messages.map((m) => ({ role: m.role, content: m.content })),
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

    // Update title if it's the first user message
    if (group.messages.length === 2) {
      try {
        // Generate smart title using OpenAI
        group.title = await generateConversationTitle(content);
      } catch (error) {
        console.error("Error generating title:", error);
        // Fallback to first 50 characters if title generation fails
        const firstUserContent = content.substring(0, 50);
        group.title = firstUserContent.length === 50 ? firstUserContent + "..." : firstUserContent;
      }
    }

    await userConversations.save();

    // Return conversation object for frontend
    const conversation = {
      _id: group._id,
      userId: req.userId,
      title: group.title,
      messages: group.messages,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    res.json({
      userMessage,
      assistantMessage,
      conversation
    });
  } catch (error) {
    console.error("Add message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Edit a message in a conversation and regenerate response
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

    // Remove the edited message and the next message (if it's an assistant response)
    group.messages.splice(messageIndex, 1);
    if (messageIndex < group.messages.length && group.messages[messageIndex].role === "assistant") {
      group.messages.splice(messageIndex, 1);
    }

    // Add the edited user message
    const editedMessage = { role: "user" as const, content: content.trim(), timestamp: new Date() };
    group.messages.splice(messageIndex, 0, editedMessage);

    // Generate new AI response
    let aiResponse = "";

    const businessUnit = req.businessUnit;
    const context = await buildContextForQuery(content, businessUnit!, req.grade || "");

    if (context.accessDenied) {
      const deniedMessage = { role: "assistant" as const, content: "You do not have access to the information required to answer this question. Please contact your HR or manager if you believe this is an error.", timestamp: new Date() };
      group.messages.push(deniedMessage);
      await userConversations.save();
      const conversation = { _id: group._id, userId: req.userId, title: group.title, messages: group.messages, createdAt: group.createdAt, updatedAt: group.updatedAt };
      return res.json({ userMessage: editedMessage, assistantMessage: deniedMessage, conversation });
    }

    const hasContext = context.source !== "none";

    try {
      const systemPrompt = hasContext
        ? `You are a helpful assistant for ${businessUnit}, a business unit of UACN.

You have been provided with information from company documents and/or external sources:

${context.hybridContextString}

IMPORTANT INSTRUCTIONS:
1. Prioritize company documents (📋) when answering - they are the official source of truth
2. Use external sources (🌐) for additional context and best practices
3. Clearly indicate which source you're referencing
4. Format responses clearly with bullet points and headers where appropriate
5. Be professional, helpful, and concise
6. Direct users to HR & Compliance for policy clarifications or disputes`
        : `You are a helpful assistant for ${businessUnit}, a business unit of UACN.

The user asked a question that doesn't have specific information in company documents OR external sources.

Inform the user politely that you don't have information on this topic, and suggest they contact HR & Compliance.`;

      aiResponse = await generateAIResponse(
        content,
        context.policies.map((p: any) => ({ title: p.title, category: p.category, content: p.content, score: p.score || 0 })),
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

    // Return conversation object for frontend
    const conversation = {
      _id: group._id,
      userId: req.userId,
      title: group.title,
      messages: group.messages,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    };

    res.json({
      userMessage: editedMessage,
      assistantMessage,
      conversation
    });
  } catch (error) {
    console.error("Edit message error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Stream AI response for real-time display
conversationRouter.post("/:id/message-stream", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

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

    const userMessage = { role: "user" as const, content: content.trim(), timestamp: new Date() };
    group.messages.push(userMessage);

    const businessUnit = req.businessUnit;
    const context = await buildContextForQuery(content, businessUnit!, req.grade || "");

    const hasContext = context.source !== "none";

    // Set up SSE headers before any writes
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (context.accessDenied) {
      const deniedContent = "You do not have access to the information required to answer this question. Please contact your HR or manager if you believe this is an error.";
      const deniedMessage = { role: "assistant" as const, content: deniedContent, timestamp: new Date() };
      group.messages.push(deniedMessage);
      if (group.messages.length === 2) {
        try { group.title = await generateConversationTitle(content); } catch { /* ignore */ }
      }
      await userConversations.save();
      const conversation = { _id: group._id, userId: req.userId, title: group.title, messages: group.messages, createdAt: group.createdAt, updatedAt: group.updatedAt };
      res.write(`data: ${JSON.stringify({ done: true, fullResponse: deniedContent, conversation })}\n\n`);
      res.end();
      return;
    }

    const systemPrompt = hasContext
      ? `You are a helpful assistant for ${businessUnit}, a business unit of UACN.

You have been provided with information from company documents and/or external sources:

${context.hybridContextString}

IMPORTANT INSTRUCTIONS:
1. Prioritize company documents (📋) when answering - they are the official source of truth
2. Use external sources (🌐) for additional context and best practices
3. Clearly indicate which source you're referencing
4. Format responses clearly with bullet points and headers where appropriate
5. Be professional, helpful, and concise
6. Direct users to HR & Compliance for policy clarifications or disputes`
      : `You are a helpful assistant for ${businessUnit}, a business unit of UACN.

The user asked a question that doesn't have specific information in company documents OR external sources.

Inform the user politely that you don't have information on this topic, and suggest they contact HR & Compliance.`;

    const policyContext = context.policies.map((p: any) => ({ title: p.title, category: p.category, content: p.content, score: p.score || 0 }));

    let fullResponse = "";

    try {
      // Stream the response
      const generator = streamAIResponse(
        content,
        policyContext,
        group.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        businessUnit,
        systemPrompt
      );

      // Send each chunk
      for await (const chunk of generator) {
        fullResponse += chunk;
        // Send chunk as SSE event
        res.write(`data: ${JSON.stringify({ chunk, fullResponse })}\n\n`);
      }

      // Save assistant message after streaming is complete
      const assistantMessage = { role: "assistant" as const, content: fullResponse, timestamp: new Date() };
      group.messages.push(assistantMessage);
      
      // Update title if it's the first user message
      if (group.messages.length === 2) {
        try {
          group.title = await generateConversationTitle(content);
        } catch (error) {
          console.error("Error generating title:", error);
          const firstUserContent = content.substring(0, 50);
          group.title = firstUserContent.length === 50 ? firstUserContent + "..." : firstUserContent;
        }
      }

      // IMPORTANT: Save to database BEFORE sending completion signal
      await userConversations.save();

      // Now send completion signal with full conversation data
      const conversation = {
        _id: group._id,
        userId: req.userId,
        title: group.title,
        messages: group.messages,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      };

      res.write(`data: ${JSON.stringify({ done: true, fullResponse, conversation })}\n\n`);
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
