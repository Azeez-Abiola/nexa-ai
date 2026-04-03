"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIResponse = generateAIResponse;
exports.streamAIResponse = streamAIResponse;
exports.generateConversationTitle = generateConversationTitle;
const openai_1 = __importDefault(require("openai"));
const js_tiktoken_1 = require("js-tiktoken");
const businessUnits_1 = require("../config/businessUnits");
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
const tokenEncoder = (0, js_tiktoken_1.encodingForModel)("gpt-4o-mini");
/**
 * Estimate token count for a string
 */
function estimateTokens(text) {
    try {
        return tokenEncoder.encode(text).length;
    }
    catch {
        // Fallback: rough estimate (1 token ≈ 4 characters)
        return Math.ceil(text.length / 4);
    }
}
/**
 * Trim conversation history to keep only last N messages to reduce token usage
 */
function trimConversationHistory(history, maxMessages = 8) {
    if (history.length <= maxMessages)
        return history;
    return history.slice(-maxMessages);
}
/**
 * Format AI response with consistent styling
 */
function formatResponse(response) {
    // Already in markdown, just ensure it's properly formatted
    return response.trim();
}
/**
 * Build detailed system prompt with formatting guidance
 */
function buildSystemPrompt(correctBUName, policyContext, hasPolicies) {
    const basePrompt = `You are ${correctBUName}'s Policy Assistant.`;
    // Condensed formatting guide (saves ~150 tokens)
    const formattingGuide = `Format responses with: **bold** for key terms, *italics* for emphasis, ### headers, numbered/bullet lists, --- separators, and code blocks for examples.`;
    if (hasPolicies) {
        return `${basePrompt}

${formattingGuide}

${policyContext}

Rules: ONLY reference above documents. Cite document sections and links. If not found, say "Not in our documents. Contact HR & Compliance." Include relevant links in responses. Be professional and concise.`;
    }
    else {
        return `${basePrompt}

${formattingGuide}

Rules: Only provide ${correctBUName} information. Ignore other BUs. When unsure, direct to HR & Compliance. Recommend HR verification. Be professional and concise.`;
    }
}
/**
 * Generate AI response using OpenAI with policy context
 */
async function generateAIResponse(userMessage, policies, conversationHistory, businessUnit = "UFL", customSystemPrompt) {
    try {
        // Get correct business unit name from config
        const buConfig = (0, businessUnits_1.getBusinessUnitConfig)(businessUnit);
        const correctBUName = buConfig ? (0, businessUnits_1.formatBusinessUnit)(businessUnit) : `${businessUnit}`;
        // OPTIMIZATION 1: Trim conversation history to last 8 messages (reduce tokens)
        const trimmedHistory = trimConversationHistory(conversationHistory, 8);
        // OPTIMIZATION 3: Score and limit policies to top 3 most relevant
        const topPolicies = policies
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 3);
        // Build policy context (condensed format)
        let policyContext = "";
        let hasPolicies = false;
        if (topPolicies.length > 0) {
            hasPolicies = true;
            policyContext = "\n### Relevant Policies:\n";
            topPolicies.forEach((policy, idx) => {
                policyContext += `\n**${idx + 1}. ${policy.title}** *(${policy.category})*\n${policy.content}\n`;
            });
        }
        // OPTIMIZATION 5: Use custom system prompt if provided, otherwise build standard one
        const systemPrompt = customSystemPrompt || buildSystemPrompt(correctBUName, policyContext, hasPolicies);
        const systemTokens = estimateTokens(systemPrompt);
        const userTokens = estimateTokens(userMessage);
        const historyTokens = estimateTokens(trimmedHistory.map((m) => m.content).join(" "));
        const totalTokens = systemTokens + userTokens + historyTokens;
        // OPTIMIZATION 2: Validate token count doesn't exceed safety threshold
        const TOKEN_LIMIT = 3500;
        if (totalTokens > TOKEN_LIMIT) {
            // Token warning silently logged by system
        }
        // Prepare messages for openai
        const messages = [
            {
                role: "system",
                content: systemPrompt,
            },
            ...trimmedHistory.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
            {
                role: "user",
                content: userMessage,
            },
        ];
        // OPTIMIZATION 4: Add request timeout (30 seconds)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        try {
            // Call OpenAI API with timeout
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages,
                temperature: 0.7,
                max_tokens: 800,
            });
            clearTimeout(timeoutId);
            const assistantMessage = response.choices[0]?.message?.content ||
                "I apologize, but I couldn't generate a response. Please try again.";
            const formattedResponse = formatResponse(assistantMessage);
            return formattedResponse;
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    catch (error) {
        if (error instanceof Error && error.message.includes("aborted")) {
            throw new Error("Request timeout - please try again");
        }
        throw new Error("Failed to generate AI response");
    }
}
/**
 * Stream AI response using OpenAI streaming API
 * Yields chunks of text as they are generated
 */
async function* streamAIResponse(userMessage, policies, conversationHistory, businessUnit = "UFL", customSystemPrompt) {
    try {
        // Get correct business unit name from config
        const buConfig = (0, businessUnits_1.getBusinessUnitConfig)(businessUnit);
        const correctBUName = buConfig ? (0, businessUnits_1.formatBusinessUnit)(businessUnit) : `${businessUnit}`;
        // Trim conversation history to last 8 messages
        const trimmedHistory = trimConversationHistory(conversationHistory, 8);
        // Score and limit policies to top 3 most relevant
        const topPolicies = policies
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 3);
        // Build policy context
        let policyContext = "";
        let hasPolicies = false;
        if (topPolicies.length > 0) {
            hasPolicies = true;
            policyContext = "\n### Relevant Policies:\n";
            topPolicies.forEach((policy, idx) => {
                policyContext += `\n**${idx + 1}. ${policy.title}** *(${policy.category})*\n${policy.content}\n`;
            });
        }
        // Use custom system prompt if provided
        const systemPrompt = customSystemPrompt || buildSystemPrompt(correctBUName, policyContext, hasPolicies);
        // Prepare messages for OpenAI
        const messages = [
            {
                role: "system",
                content: systemPrompt,
            },
            ...trimmedHistory.map((msg) => ({
                role: msg.role,
                content: msg.content,
            })),
            {
                role: "user",
                content: userMessage,
            },
        ];
        // Create streaming request
        const stream = (await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages,
            temperature: 0.7,
            max_tokens: 800,
            stream: true,
        }));
        // Yield each chunk as it arrives
        for await (const chunk of stream) {
            if (chunk.choices && chunk.choices.length > 0 && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                yield chunk.choices[0].delta.content;
            }
        }
    }
    catch (error) {
        if (error instanceof Error && error.message.includes("aborted")) {
            throw new Error("Request timeout - please try again");
        }
        throw new Error("Failed to generate AI response");
    }
}
/**
 * Generate a smart conversation title using OpenAI (with timeout and optimizations)
 */
async function generateConversationTitle(userMessage) {
    try {
        // Add request timeout (15 seconds for title generation)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `Create a brief title (5-10 words, professional). Return ONLY the title text.`
                    },
                    {
                        role: "user",
                        content: `Title for: "${userMessage.substring(0, 100)}"`
                    }
                ],
                temperature: 0.7,
                max_tokens: 30,
            });
            clearTimeout(timeoutId);
            const title = response.choices[0]?.message?.content?.trim() || "New Chat";
            if (title && title.length > 0) {
                return title;
            }
        }
        finally {
            clearTimeout(timeoutId);
        }
        // Fallback: use first 40 characters of message
        const firstLineContent = userMessage.substring(0, 40);
        return firstLineContent.length === 40 ? firstLineContent + "..." : firstLineContent;
    }
    catch (error) {
        // Fallback: use first 40 characters if AI fails
        const firstLineContent = userMessage.substring(0, 40);
        return firstLineContent.length === 40 ? firstLineContent + "..." : firstLineContent;
    }
}
