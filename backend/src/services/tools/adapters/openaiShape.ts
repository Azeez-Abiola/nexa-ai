import OpenAI from "openai";
import { CanonicalTool } from "../types";

/**
 * Adapter: canonical tools → the OpenAI-shaped dialects.
 *
 * Covers three of the four providers, but not with one function. OpenAI's Responses
 * API and its own Chat Completions API disagree about where a function's fields go:
 * Chat Completions nests them under `function`, Responses flattens them to the top
 * level. DeepSeek and Kimi are OpenAI-compatible in the Chat Completions sense, so
 * they use the nested form.
 *
 * Everything vendor-specific about tool calling for these three providers lives in
 * this file. Nothing above it should know that two dialects exist.
 */

/**
 * Chat Completions tool definitions — DeepSeek, Kimi, and any other
 * OpenAI-compatible endpoint.
 */
export function toChatCompletionsTools(catalog: CanonicalTool[]): OpenAI.Chat.ChatCompletionTool[] {
  return catalog.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters as unknown as Record<string, unknown>
    }
  }));
}

/**
 * Responses API tool definitions — GPT.
 *
 * `strict` is off deliberately. Strict mode requires every property to be listed in
 * `required` and `additionalProperties: false` throughout, and these schemas are
 * authored by whichever MCP server owns the tool — Nexa does not control them. A
 * schema that fails strict validation is rejected with an opaque 400 at request
 * time, which would make a third-party connector's schema a runtime outage.
 */
export function toResponsesTools(catalog: CanonicalTool[]): OpenAI.Responses.FunctionTool[] {
  return catalog.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as unknown as Record<string, unknown>,
    strict: false
  }));
}

/** A tool call in canonical form, extracted from whichever dialect produced it. */
export interface ParsedToolCall {
  /** The id the provider expects to see echoed on the result. */
  callId: string;
  name: string;
  args: Record<string, unknown>;
  /** Set when the model emitted arguments that are not valid JSON. */
  parseError?: string;
}

/**
 * Parse a tool call's arguments.
 *
 * Both dialects deliver arguments as a JSON *string*, which the model generated
 * token by token — so malformed JSON is a normal occurrence, not an exceptional one.
 * The failure is captured rather than thrown so the loop can hand the model its own
 * error and let it retry, which costs one iteration instead of the whole turn.
 */
function parseArguments(raw: string): { args: Record<string, unknown>; parseError?: string } {
  if (!raw || !raw.trim()) return { args: {} };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { args: parsed as Record<string, unknown> };
    }
    return { args: {}, parseError: "Arguments must be a JSON object." };
  } catch (err) {
    return {
      args: {},
      parseError: `Arguments were not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

/** Extract tool calls from a Chat Completions assistant message. */
export function parseChatCompletionsToolCalls(
  toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] | undefined
): ParsedToolCall[] {
  if (!toolCalls?.length) return [];
  return toolCalls
    .filter((call) => call.type === "function")
    .map((call) => {
      const fn = (call as OpenAI.Chat.ChatCompletionMessageFunctionToolCall).function;
      const { args, parseError } = parseArguments(fn.arguments);
      return { callId: call.id, name: fn.name, args, parseError };
    });
}

/** Extract tool calls from a Responses API output array. */
export function parseResponsesToolCalls(output: unknown[]): ParsedToolCall[] {
  return output
    .filter((item): item is OpenAI.Responses.ResponseFunctionToolCall => {
      return (item as { type?: string })?.type === "function_call";
    })
    .map((item) => {
      const { args, parseError } = parseArguments(item.arguments);
      return { callId: item.call_id, name: item.name, args, parseError };
    });
}

/** The Chat Completions message carrying a tool's output back to the model. */
export function chatCompletionsToolResult(
  callId: string,
  content: string
): OpenAI.Chat.ChatCompletionToolMessageParam {
  return { role: "tool", tool_call_id: callId, content };
}

/** The Responses API input item carrying a tool's output back to the model. */
export function responsesToolResult(
  callId: string,
  content: string
): OpenAI.Responses.ResponseInputItem {
  return { type: "function_call_output", call_id: callId, output: content };
}
