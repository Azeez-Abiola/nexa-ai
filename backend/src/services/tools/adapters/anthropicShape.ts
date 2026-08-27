import Anthropic from "@anthropic-ai/sdk";
import { CanonicalTool } from "../types";
import { ParsedToolCall } from "./openaiShape";

/**
 * Adapter: canonical tools → Anthropic's Messages API dialect.
 *
 * The one provider that genuinely differs. Three things change rather than one:
 *
 *   1. Schemas sit under `input_schema`, not `parameters`.
 *   2. A call arrives as a `tool_use` *content block* inside the assistant message,
 *      with `input` already parsed as an object — not a JSON string to decode.
 *   3. Results go back as `tool_result` blocks in a message with role `"user"`,
 *      not a dedicated `tool` role.
 *
 * Point 3 is the one that bites: it is a user-role message that the user did not
 * write, and every result block for a turn must travel in a single message.
 */

export function toAnthropicTools(catalog: CanonicalTool[]): Anthropic.Messages.Tool[] {
  return catalog.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters as unknown as Anthropic.Messages.Tool.InputSchema
  }));
}

/**
 * Extract the client-executable tool calls from an assistant message.
 *
 * Hosted tools are skipped by construction. Claude's server-side web search comes
 * back as `server_tool_use` / `web_search_tool_result` blocks, which Anthropic has
 * already executed — treating one as a connector call would send it to an MCP server
 * that has never heard of it. Only `tool_use` blocks are ours to run.
 *
 * No JSON parsing here, and no parseError: `input` is delivered as a decoded object,
 * so the malformed-arguments case the OpenAI dialects have simply does not arise.
 */
export function parseAnthropicToolCalls(content: Anthropic.ContentBlock[]): ParsedToolCall[] {
  return content
    .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
    .map((block) => ({
      callId: block.id,
      name: block.name,
      args: (block.input ?? {}) as Record<string, unknown>
    }));
}

/**
 * Build the single user message carrying every tool result for one turn.
 *
 * All results must arrive together in one message. Splitting them across several
 * messages is accepted by the API but teaches the model that parallel calls are not
 * worth making, and it silently stops issuing them — a performance regression with
 * no error to trace it back to.
 */
export function anthropicToolResultMessage(
  results: Array<{ callId: string; content: string; ok: boolean }>
): Anthropic.MessageParam {
  const blocks: Anthropic.ToolResultBlockParam[] = results.map((result) => ({
    type: "tool_result",
    tool_use_id: result.callId,
    content: result.content,
    // Flagged rather than dropped, so a failure reads as a failed tool instead of
    // an empty answer the model has to guess at.
    ...(result.ok ? {} : { is_error: true })
  }));

  return { role: "user", content: blocks };
}
