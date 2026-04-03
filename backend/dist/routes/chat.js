"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = void 0;
const express_1 = __importDefault(require("express"));
const Policy_1 = require("../models/Policy");
const auth_1 = require("../middleware/auth");
const businessUnits_1 = require("../config/businessUnits");
const googleSearchService_1 = require("../services/googleSearchService");
const openaiService_1 = require("../services/openaiService");
exports.chatRouter = express_1.default.Router();
// Simple in-memory per-BU rate limiter: max 30 requests per minute per business unit
const buRateLimiter = (() => {
    const counts = new Map();
    const WINDOW_MS = 60000;
    const MAX_REQUESTS = 30;
    return (req, res, next) => {
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
// Questions patterns to extract intent
const INTENT_PATTERNS = {
    leave: /\b(leave|vacation|time off|days off|holiday|absent)\b/i,
    salary: /\b(salary|pay|compensation|wage|payroll|bonus|allowance)\b/i,
    benefits: /\b(benefit|health|insurance|medical|dental|pension)\b/i,
    attendance: /\b(attendance|present|attendance policy|check in)\b/i,
    code_of_conduct: /\b(conduct|behavior|dress code|ethics|discipline)\b/i,
    work_hours: /\b(work hours|working hours|office hours|schedule|shift)\b/i,
    remote_work: /\b(remote|work from home|wfh|work-from-home)\b/i,
    training: /\b(training|development|course|certification|learning)\b/i,
    harassment: /\b(harassment|discrimination|bullying|toxic|respect)\b/i
};
// Function to detect if message is a greeting
const isGreeting = (message) => {
    const trimmed = message.trim();
    return GREETING_PATTERNS.some((pattern) => pattern.test(trimmed));
};
// Function to extract intent keywords
const extractIntents = (message) => {
    const intents = [];
    for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
        if (pattern.test(message)) {
            intents.push(intent);
        }
    }
    return intents;
};
// Greeting responses
const getGreetingResponse = (businessUnit) => {
    const buConfig = (0, businessUnits_1.getBusinessUnitConfig)(businessUnit);
    const buName = buConfig ? (0, businessUnits_1.formatBusinessUnit)(businessUnit) : businessUnit;
    const greetings = [
        `👋 Hello! Welcome to Nexa AI. I'm here to help with ${buName} policies and information. What can I assist you with today?`,
        `Hey there! 👋 I'm Nexa AI, your ${buName} policy assistant. Feel free to ask me about any company policies or guidelines.`,
        `Good to see you! 👋 I can help you find information about ${buName} policies, benefits, work guidelines, and more. What would you like to know?`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
};
// Call OpenAI API
async function callOpenAIAPI(systemPrompt, userMessage) {
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
exports.chatRouter.post("/", auth_1.authMiddleware, buRateLimiter, async (req, res) => {
    const { messages } = req.body;
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
                reply: getGreetingResponse(businessUnit)
            });
        }
        // Extract intent from message
        const intents = extractIntents(userMessage);
        // Build search query combining user message and intents
        let searchQuery = userMessage;
        if (intents.length > 0) {
            searchQuery = `${userMessage} ${intents.join(" ")}`;
        }
        // HYBRID APPROACH: Search policies AND Google in parallel
        console.log(`[Chat] Searching for: "${searchQuery}"`);
        const [policiesRef, googleRef] = await Promise.allSettled([
            // Search internal policies
            Policy_1.Policy.find({
                businessUnit: businessUnit,
                $text: { $search: searchQuery }
            }, { score: { $meta: "textScore" } })
                .sort({ score: { $meta: "textScore" } })
                .limit(3)
                .lean()
                .catch(async () => {
                // Fallback to regex search if full-text index unavailable
                const regexPatterns = searchQuery
                    .split(/\s+/)
                    .filter((w) => w.length > 2);
                return Policy_1.Policy.find({
                    businessUnit: businessUnit,
                    $or: [
                        { title: { $regex: regexPatterns.join("|"), $options: "i" } },
                        { content: { $regex: regexPatterns.join("|"), $options: "i" } },
                        {
                            category: {
                                $regex: regexPatterns.join("|"),
                                $options: "i"
                            }
                        }
                    ]
                })
                    .limit(3)
                    .lean();
            }),
            // Search Google in parallel
            (0, googleSearchService_1.searchGoogle)(searchQuery, 3)
        ]);
        // Extract results from Promise.allSettled
        const policies = policiesRef.status === "fulfilled" ? policiesRef.value : [];
        const googleResults = googleRef.status === "fulfilled" && googleRef.value?.success
            ? googleRef.value.results || []
            : [];
        console.log(`[Chat] Policies found: ${policies?.length || 0}`);
        console.log(`[Chat] Google search status:`, googleRef.status);
        console.log(`[Chat] Google search full response:`, googleRef.status === "fulfilled" ? JSON.stringify(googleRef.value).substring(0, 500) : googleRef.reason);
        console.log(`[Chat] Google results found: ${googleResults?.length || 0}`);
        if (googleRef.status === "rejected") {
            console.error(`[Chat] Google search rejected:`, googleRef.reason);
        }
        else if (googleRef.status === "fulfilled" && !googleRef.value?.success) {
            console.warn(`[Chat] Google search failed:`, googleRef.value?.error);
        }
        const buConfig = (0, businessUnits_1.getBusinessUnitConfig)(businessUnit);
        const buName = buConfig ? (0, businessUnits_1.formatBusinessUnit)(businessUnit) : businessUnit;
        const buAbbr = buConfig?.abbr || businessUnit;
        // Build hybrid context for OpenAI
        const hybridContext = (0, googleSearchService_1.buildHybridContext)(policies, googleResults);
        const hasPolicies = policies && policies.length > 0;
        const hasExternalSources = googleResults.length > 0;
        console.log(`[Chat] hasPolicies:`, hasPolicies);
        console.log(`[Chat] hasExternalSources:`, hasExternalSources);
        console.log(`[Chat] Will enter hybrid response:`, hasPolicies || hasExternalSources);
        if (hasPolicies || hasExternalSources) {
            // Create system prompt that handles both sources
            const systemPrompt = `You are a helpful assistant for ${buName} (${buAbbr}), a business unit of UACN.

You have been provided with information from TWO sources:

1. **COMPANY POLICIES** (marked with 📋) - Official internal documents
2. **EXTERNAL SOURCES** (marked with 🌐) - Information from Google Search

${hybridContext}

IMPORTANT INSTRUCTIONS:
1. Prioritize company policies (📋) when answering questions - they are the official source of truth
2. Use external sources (🌐) to provide additional context, best practices, or industry standards
3. Clearly indicate which source you're referencing: e.g., "According to our policy..." or "Industry best practices suggest..."
4. If company policies conflict with external sources, follow company policy
5. Format responses clearly with bullet points, headers, and links where appropriate
6. Always cite document sections and provide links to relevant policies
7. For topics not covered in company policies, supplement with external sources while making the distinction clear
8. Be professional, helpful, and concise
9. Direct users to HR & Compliance for policy clarifications or disputes`;
            try {
                const reply = await callOpenAIAPI(systemPrompt, userMessage);
                // Append external sources footer if available
                let finalReply = reply;
                if (hasExternalSources) {
                    const externalSourcesFooter = (0, googleSearchService_1.formatSearchResultsForChat)(googleResults);
                    finalReply += externalSourcesFooter;
                    finalReply += "\n\n💡 **Note:** External sources complement company policies but company policies take precedence.";
                }
                return res.json({ reply: finalReply });
            }
            catch (error) {
                // Fallback: Display both sources manually
                let response = "";
                if (hasPolicies) {
                    response += `### Found Relevant ${policies.length > 1 ? "Documents" : "Document"}\n\n`;
                    policies.forEach((policy, idx) => {
                        response += `**${idx + 1}. ${policy.title}** (Company Policy)\n`;
                        response += `*Category: ${policy.category}*\n\n`;
                        response += `${policy.content}\n\n`;
                        if (idx < policies.length - 1) {
                            response += `---\n\n`;
                        }
                    });
                }
                if (hasExternalSources) {
                    if (hasPolicies) {
                        response += `\n---\n\n### Additional External Sources\n\n`;
                    }
                    else {
                        response += `### External Information Found\n\n`;
                    }
                    const externalSourcesFooter = (0, googleSearchService_1.formatSearchResultsForChat)(googleResults);
                    response += externalSourcesFooter;
                }
                response += `\n\n**Need More Help?**\n• Contact HR & Compliance for policy questions`;
                return res.json({ reply: response });
            }
        }
        // No matching policies or external sources - provide helpful guidance
        const noMatchSystemPrompt = `You are a helpful assistant for ${buName} (${buAbbr}), a business unit of UACN.

The user asked a question that doesn't have specific information in company documents OR external sources.

Politely explain that you couldn't find relevant information and direct them to HR & Compliance.
Be helpful and professional.`;
        try {
            const reply = await callOpenAIAPI(noMatchSystemPrompt, userMessage);
            return res.json({ reply });
        }
        catch (error) {
            return res.json({
                reply: `### No Information Found\n\n` +
                    `You asked about: *${userMessage}*\n\n` +
                    `**Suggestions:**\n` +
                    `• Try rephrasing your question with different keywords\n` +
                    `• Ask about specific topics: leave, salary, benefits, work hours, training, code of conduct\n` +
                    `• Contact HR & Compliance directly for detailed information\n\n` +
                    `How can I help you further?`
            });
        }
    }
    catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Public chat endpoint - no authentication required (for landing page chatbot)
exports.chatRouter.post("/public", async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "messages array is required" });
    }
    try {
        const userMessage = messages[messages.length - 1]?.content || "";
        console.log(`[Chat/Public] ========== NEW REQUEST ==========`);
        console.log(`[Chat/Public] User message: "${userMessage}"`);
        // Search for relevant information from Google (hybrid approach for public)
        console.log(`[Chat/Public] Starting Google search...`);
        const googleResults = await (0, googleSearchService_1.searchGoogle)(userMessage, 3);
        console.log(`[Chat/Public] Google search complete:`, googleResults.success ? `✓ ${googleResults.results?.length || 0} results` : `✗ Error: ${googleResults.error}`);
        // Build business units list dynamically from config
        const businessUnitsList = Object.values(businessUnits_1.BUSINESS_UNITS)
            .map(bu => `- ${bu.label} - ${bu.description}`)
            .join("\n");
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
                const externalSourcesFooter = (0, googleSearchService_1.formatSearchResultsForChat)(googleResults.results);
                finalReply += externalSourcesFooter;
            }
            console.log(`[Chat/Public] Sending response`);
            return res.json({ reply: finalReply });
        }
        catch (error) {
            console.error("[Chat/Public] OpenAI error:", error);
            return res.json({
                reply: "Hello! 👋 I'm the UACN assistant. I'm having a temporary issue, but I'd be happy to help!\n\n" +
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
    }
    catch (error) {
        console.error("[Chat/Public] Unhandled error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Streaming chat endpoint - for real-time response display
// Sends response as Server-Sent Events (SSE) as it's generated by OpenAI
exports.chatRouter.post("/public/stream", async (req, res) => {
    const { messages } = req.body;
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
            const stream = await (0, openaiService_1.streamAIResponse)(userMessage, [], // no internal policies for unauthenticated public stream
            messages.filter(m => m.role !== "system"), "UACN", systemPrompt);
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
        }
        catch (streamError) {
            console.error(`[Chat/Stream] Streaming error:`, streamError);
            res.write(`data: ${JSON.stringify({
                type: "error",
                content: "Sorry, I encountered an error generating the response. Please try again."
            })}\n\n`);
            res.end();
        }
    }
    catch (error) {
        console.error("[Chat/Stream] Request error:", error);
        res.write(`data: ${JSON.stringify({
            type: "error",
            content: "An error occurred. Please try again."
        })}\n\n`);
        res.end();
    }
});
