"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIResponse = generateAIResponse;
const ollama_1 = require("ollama");
// Initialize Ollama client
const ollama = new ollama_1.Ollama({
    host: process.env.OLLAMA_HOST || "http://0.0.0.0:11434",
});
// Default model - you can change this to any model you have installed
const MODEL = process.env.OLLAMA_MODEL || "mistral";
/**
 * Generate AI response using Ollama with policy context
 */
async function generateAIResponse(userMessage, policies, conversationHistory) {
    try {
        // Build policy context
        let policyContext = "";
        let hasPolicies = false;
        if (policies.length > 0) {
            hasPolicies = true;
            policyContext = "\n\nRelevant company policies:\n";
            policies.forEach((policy, idx) => {
                policyContext += `\n${idx + 1}. **${policy.title}** (${policy.category})\n`;
                policyContext += `${policy.content}\n`;
            });
        }
        // Build system prompt based on whether policies were found
        let systemPrompt = `You are UFL GPT, a helpful company policy assistant for UFL (University of Foreign Languages). 
Your role is to answer questions about company policies, benefits, work guidelines, and HR-related information in a friendly and professional manner.`;
        if (hasPolicies) {
            // Strict mode: Only use provided policies
            systemPrompt += `${policyContext}

Guidelines:
- PRIORITY: Answer questions based ONLY on the provided company policies above
- If information is not found in the policies provided, tell the user to contact HR & Compliance
- Be friendly, helpful, and professional
- Use markdown formatting for clarity (bold, lists, etc.)
- Keep responses concise but comprehensive
- Never make assumptions beyond what's in the policies`;
        }
        else {
            // Flexible mode: Use general knowledge if no policies found
            systemPrompt += `

Guidelines:
- If you can find relevant company policy information, mention it
- If no specific company policy information is available, provide helpful general information on the topic
- Always recommend the user verify critical information with HR & Compliance
- Be friendly, helpful, and professional
- Use markdown formatting for clarity (bold, lists, etc.)
- Keep responses concise but comprehensive
- If the user asks something unrelated to policies or work, politely redirect them`;
        }
        // Build conversation for Ollama
        let conversationText = systemPrompt + "\n\n";
        // Add conversation history
        for (const msg of conversationHistory) {
            if (msg.role === "user") {
                conversationText += `User: ${msg.content}\n`;
            }
            else if (msg.role === "assistant") {
                conversationText += `Assistant: ${msg.content}\n`;
            }
        }
        // Add current user message
        conversationText += `User: ${userMessage}\nAssistant:`;
        // Call Ollama API
        const response = await ollama.generate({
            model: MODEL,
            prompt: conversationText,
            stream: false,
            options: {
                temperature: 0.7,
                num_predict: 1000,
            },
        });
        const assistantMessage = response.response?.trim() ||
            "I apologize, but I couldn't generate a response. Please try again.";
        return assistantMessage;
    }
    catch (error) {
        console.error("Ollama API error:", error);
        throw new Error("Failed to generate AI response");
    }
}
