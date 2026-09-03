import { ParsedToolCall } from "./adapters/openaiShape";
import { executeTool } from "./router";
import { CanonicalTool, StreamEvent, ToolContext } from "./types";
import logger from "../../utils/logger";

/** What a provider needs to hand back to the model after a round of tool calls. */
export interface CompletedToolCall {
  callId: string;
  content: string;
  ok: boolean;
}

/**
 * Run one round of tool calls, emitting UI events as it goes.
 *
 * Shared by all four providers: this is where a tool call stops being
 * provider-specific. Each service translates its own dialect into `ParsedToolCall[]`,
 * hands them here, and translates the returned results back — so the execution
 * semantics (parallelism, error handling, what the user sees) are identical no matter
 * which model is driving, which is the property the whole design is for.
 *
 * Results are pushed into `sink` in call order rather than returned, because this is
 * a generator: its return value is awkward to reach through `yield*`, and every
 * caller wants the events and the results together.
 */
export async function* runToolCalls(
  calls: ParsedToolCall[],
  catalog: CanonicalTool[],
  ctx: ToolContext,
  sink: CompletedToolCall[]
): AsyncGenerator<StreamEvent, void, unknown> {
  const byName = new Map(catalog.map((tool) => [tool.name, tool]));

  // Announced before any execution starts, so a user watching three parallel calls
  // sees all three appear at once rather than trickling in as they complete.
  for (const call of calls) {
    const tool = byName.get(call.name);
    yield {
      type: "tool_call",
      callId: call.callId,
      tool: call.name,
      connector: tool?.connectorId ?? "",
      connectorLabel: tool?.connectorLabel ?? "",
      label: tool?.label ?? `Running ${call.name}`,
      args: call.args
    };
  }

  /**
   * Executed concurrently. All four providers can emit several tool calls in one
   * turn, and running them in series would make a three-call turn three times as
   * slow for no reason — they are independent by construction, since the model
   * issued them without seeing any of their results.
   */
  const settled = await Promise.all(
    calls.map(async (call): Promise<CompletedToolCall & { durationMs: number; summary: string }> => {
      const started = Date.now();

      // A malformed-arguments failure never reaches a connector. The model gets its
      // own error back and can correct itself on the next iteration, which costs one
      // round trip instead of the turn.
      if (call.parseError) {
        logger.warn("[ToolLoop] Malformed tool arguments", {
          tool: call.name,
          provider: ctx.provider,
          error: call.parseError
        });
        return {
          callId: call.callId,
          ok: false,
          content: `${call.parseError} Call ${call.name} again with valid JSON arguments.`,
          summary: "invalid arguments",
          durationMs: Date.now() - started
        };
      }

      const result = await executeTool(call.name, call.args, ctx);
      return {
        callId: call.callId,
        ok: result.ok,
        content: result.content,
        summary: result.summary,
        durationMs: Date.now() - started
      };
    })
  );

  for (const result of settled) {
    sink.push({ callId: result.callId, content: result.content, ok: result.ok });
    const call = calls.find((c) => c.callId === result.callId);
    const tool = call ? byName.get(call.name) : undefined;
    yield {
      type: "tool_result",
      callId: result.callId,
      tool: call?.name ?? "",
      connector: tool?.connectorId ?? "",
      ok: result.ok,
      summary: result.summary,
      durationMs: result.durationMs
    };
  }
}

/**
 * The note appended to a system prompt when the tool ceiling is reached.
 *
 * Without it the turn ends on a tool result with no assistant text, and the user
 * sees an answer that stops mid-thought. Telling the model it is out of tool calls
 * gets a real answer out of what it has already gathered.
 */
export const TOOL_BUDGET_EXHAUSTED_NOTE =
  "You have used all available tool calls for this turn. Answer now using what you have already retrieved, and say plainly if something could not be checked.";
