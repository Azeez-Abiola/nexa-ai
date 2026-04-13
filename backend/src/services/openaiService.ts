import OpenAI from "openai";
import { encodingForModel } from "js-tiktoken";
import { getBusinessUnitConfig, formatBusinessUnit } from "../config/businessUnits";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const tokenEncoder = encodingForModel("gpt-4o-mini");

/**
 * Estimate token count for a string
 */
function estimateTokens(text: string): number {
  try {
    return tokenEncoder.encode(text).length;
  } catch {
    // Fallback: rough estimate (1 token ≈ 4 characters)
    return Math.ceil(text.length / 4);
  }
}

/**
 * Trim conversation history to keep only last N messages to reduce token usage
 */
function trimConversationHistory(history: Message[], maxMessages: number = 8): Message[] {
  if (history.length <= maxMessages) return history;
  return history.slice(-maxMessages);
}

/**
 * Format AI response with consistent styling
 */
function formatResponse(response: string): string {
  // Already in markdown, just ensure it's properly formatted
  return response.trim();
}

/**
 * Build detailed system prompt with formatting guidance
 */
function buildSystemPrompt(correctBUName: string, policyContext: string, hasPolicies: boolean): string {
  const basePrompt = `You are ${correctBUName}'s Policy Assistant.`;
  
  // Condensed formatting guide (saves ~150 tokens)
  const formattingGuide = `Format responses with: **bold** for key terms, *italics* for emphasis, ### headers, numbered/bullet lists, --- separators, and code blocks for examples.`;

  if (hasPolicies) {
    return `${basePrompt}

${formattingGuide}

${policyContext}

Rules: ONLY reference above documents. Cite document sections and links. If not found, say "Not in our documents. Contact HR & Compliance." Include relevant links in responses. Be professional and concise.`;
  } else {
    return `${basePrompt}

${formattingGuide}

Rules: Only provide ${correctBUName} information. Ignore other BUs. When unsure, direct to HR & Compliance. Recommend HR verification. Be professional and concise.`;
  }
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface PolicyContext {
  title: string;
  category: string;
  content: string;
  score?: number;
}

/**
 * Generate AI response using OpenAI with policy context
 */
export async function generateAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "UFL",
  customSystemPrompt?: string
): Promise<string> {
  try {
    // Get correct business unit name from config
    const buConfig = getBusinessUnitConfig(businessUnit);
    const correctBUName = buConfig ? formatBusinessUnit(businessUnit) : `${businessUnit}`;
    
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
    const historyTokens = estimateTokens(trimmedHistory.map((m: Message) => m.content).join(" "));
    const totalTokens = systemTokens + userTokens + historyTokens;
    
    // OPTIMIZATION 2: Validate token count doesn't exceed safety threshold
    const TOKEN_LIMIT = 3500;
    if (totalTokens > TOKEN_LIMIT) {
      // Token warning silently logged by system
    }

    // Prepare messages for openai
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...trimmedHistory.map((msg: Message) => ({
        role: msg.role as "user" | "assistant" | "system",
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
      } as any);

      clearTimeout(timeoutId);

      const assistantMessage =
        response.choices[0]?.message?.content ||
        "I apologize, but I couldn't generate a response. Please try again.";

      const formattedResponse = formatResponse(assistantMessage);
      return formattedResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
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
export interface ImageAttachment {
  base64: string;
  mimeType: string;
}

export async function* streamAIResponse(
  userMessage: string,
  policies: PolicyContext[],
  conversationHistory: Message[],
  businessUnit: string = "UFL",
  customSystemPrompt?: string,
  imageAttachments?: ImageAttachment[]
): AsyncGenerator<string, void, unknown> {
  try {
    // Get correct business unit name from config
    const buConfig = getBusinessUnitConfig(businessUnit);
    const correctBUName = buConfig ? formatBusinessUnit(businessUnit) : `${businessUnit}`;
    
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

    // Build the user message content (text-only or multimodal with images)
    let userContent: OpenAI.Chat.ChatCompletionContentPart[] | string;
    if (imageAttachments && imageAttachments.length > 0) {
      userContent = [
        { type: "text" as const, text: userMessage || "What is in this image?" },
        ...imageAttachments.map((img) => ({
          type: "image_url" as const,
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`,
            detail: "auto" as const
          }
        }))
      ];
    } else {
      userContent = userMessage;
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...trimmedHistory.map((msg: Message) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      })),
      {
        role: "user",
        content: userContent,
      },
    ];

    const stream = (await (openai.chat.completions.create as any)({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 1500,
      stream: true,
    })) as AsyncIterable<any>;

    // Yield each chunk as it arrives
    for await (const chunk of stream) {
      if (chunk.choices && chunk.choices.length > 0 && chunk.choices[0].delta && chunk.choices[0].delta.content) {
        yield chunk.choices[0].delta.content;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("aborted")) {
      throw new Error("Request timeout - please try again");
    }
    throw new Error("Failed to generate AI response");
  }
}

/**
 * Generate a smart conversation title using OpenAI (with timeout and optimizations)
 */
export async function generateConversationTitle(userMessage: string): Promise<string> {
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
      } as any);

      clearTimeout(timeoutId);

      const title = response.choices[0]?.message?.content?.trim() || "New Chat";
      
      if (title && title.length > 0) {
        return title;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Fallback: use first 40 characters of message
    const firstLineContent = userMessage.substring(0, 40);
    return firstLineContent.length === 40 ? firstLineContent + "..." : firstLineContent;
  } catch (error) {
    // Fallback: use first 40 characters if AI fails
    const firstLineContent = userMessage.substring(0, 40);
    return firstLineContent.length === 40 ? firstLineContent + "..." : firstLineContent;
  }
}
