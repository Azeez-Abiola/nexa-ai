import OpenAI from "openai";
import {
  parseChatCompletionsToolCalls,
  chatCompletionsToolResult,
  toChatCompletionsTools,
  ParsedToolCall
} from "./adapters/openaiShape";
import { CompletedToolCall, runToolCalls, TOOL_BUDGET_EXHAUSTED_NOTE } from "./loop";
import { resolveToolCatalog } from "./router";
import { MAX_TOOL_ITERATIONS, StreamEvent, ToolContext } from "./types";
import { isRetryableFailure, retryDelayMs } from "../providerHealth";
import logger from "../../utils/logger";

/**
 * The tool-calling stream loop for OpenAI-compatible Chat Completions endpoints.
 *
 * DeepSeek and Kimi share this rather than each carrying a copy. Their tool-calling
 * surfaces are identical — same `tools` request field, same streamed `tool_calls`
 * deltas, same `role: "tool"` result messages — and the loop is the part most likely
 * to grow subtle bugs, so there is one of it. What differs between the two providers
 * (client, model id, system prompt, token budget) arrives as arguments.
 */

const STREAM_MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const STREAM_TIMEOUT_MS = 90_000;

export interface ChatCompletionsStreamOptions {
  client: OpenAI;
  model: string;
  /** Provider slug used for audit and the write-capability check, e.g. "deepseek". */
  provider: string;
  /** Capitalised name for log prefixes, e.g. "DeepSeek". */
  logLabel: string;
  messages: OpenAI.Chat.ChatCompletionMessageParam[];
  maxTokens: number;
  /** Absent means no connectors this turn — the loop degenerates to a plain stream. */
  toolContext?: ToolContext;
  /** Called with the usage object from the final chunk of each model call. */
  onUsage: (usage: unknown) => void;
}

/** Streamed `tool_calls` deltas, accumulated by index. */
interface ToolCallAccumulator {
  id: string;
  name: string;
  args: string;
}

interface TurnOutcome {
  /** Raw tool calls, in the shape the assistant message must echo back. */
  rawToolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[];
  parsedToolCalls: ParsedToolCall[];
  text: string;
  /** True when the turn produced neither text nor a tool call and cannot be retried. */
  failed: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.message.includes("aborted") || err.name === "AbortError");
}

/**
 * Stream one model call, yielding text as it arrives.
 *
 * Retries live at this level rather than around the whole loop: once a tool has run,
 * replaying the turn would run it again. Retrying a single model call is safe because
 * a call that failed produced no tool execution.
 */
async function* streamOneTurn(
  opts: ChatCompletionsStreamOptions,
  tools: OpenAI.Chat.ChatCompletionTool[],
  hasYieldedGlobally: boolean
): AsyncGenerator<StreamEvent, TurnOutcome, unknown> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < STREAM_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = retryDelayMs(lastError, attempt, RETRY_BASE_DELAY_MS);
      logger.warn(`[${opts.logLabel}/Stream] Retrying after error`, {
        attempt,
        delayMs,
        error: lastError instanceof Error ? lastError.message : String(lastError)
      });
      await sleep(delayMs);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
    let yieldedThisAttempt = false;

    try {
      const stream = await opts.client.chat.completions.create(
        {
          model: opts.model,
          messages: opts.messages,
          max_tokens: opts.maxTokens,
          stream: true,
          // Chat Completions omits usage from stream chunks unless asked; without
          // this the final chunk carries no token counts to record.
          stream_options: { include_usage: true },
          ...(tools.length ? { tools } : {})
        },
        { signal: controller.signal }
      );

      const accumulator = new Map<number, ToolCallAccumulator>();
      let text = "";
      let usage: unknown;

      for await (const chunk of stream) {
        // The usage-bearing final chunk has an empty choices array.
        if (chunk.usage) usage = chunk.usage;

        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          text += delta.content;
          yield { type: "text", text: delta.content };
          yieldedThisAttempt = true;
        }

        for (const part of delta.tool_calls ?? []) {
          const slot = accumulator.get(part.index) ?? { id: "", name: "", args: "" };
          if (part.id) slot.id = part.id;
          const fn = (part as { function?: { name?: string; arguments?: string } }).function;
          if (fn?.name) slot.name += fn.name;
          if (fn?.arguments) slot.args += fn.arguments;
          accumulator.set(part.index, slot);
        }
      }

      opts.onUsage(usage);

      const rawToolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = [...accumulator.entries()]
        .sort(([a], [b]) => a - b)
        .filter(([, slot]) => slot.name)
        .map(([, slot]) => ({
          id: slot.id,
          type: "function" as const,
          function: { name: slot.name, arguments: slot.args }
        }));

      return {
        rawToolCalls,
        parsedToolCalls: parseChatCompletionsToolCalls(rawToolCalls),
        text,
        failed: false
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (isAbortError(err)) throw new Error("Request timeout");
      // Text already reached the client — this attempt or an earlier iteration —
      // so there is nothing to retry onto. Rewinding streamed output is impossible.
      if (yieldedThisAttempt || hasYieldedGlobally) throw err;
      lastError = err;
      if (!isRetryableFailure(err)) break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError) {
    throw new Error(
      `Failed to generate ${opts.logLabel} response: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`
    );
  }

  return { rawToolCalls: [], parsedToolCalls: [], text: "", failed: true };
}

/**
 * Stream a response, executing connector tools as the model asks for them.
 *
 * `opts.messages` is mutated as the conversation grows within the turn — the
 * assistant's tool calls and their results are appended so the next model call sees
 * them. The caller hands over ownership of the array.
 */
export async function* streamWithTools(
  opts: ChatCompletionsStreamOptions
): AsyncGenerator<StreamEvent, void, unknown> {
  const catalog = opts.toolContext ? await resolveToolCatalog(opts.toolContext) : [];
  const tools = toChatCompletionsTools(catalog);
  let hasYielded = false;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const isFinalIteration = iteration === MAX_TOOL_ITERATIONS - 1;

    const turn = yield* wrapYieldTracking(
      streamOneTurn(
        // On the last permitted iteration the tools are withheld, which is what
        // actually forces an answer: telling the model it is out of budget while
        // still offering the tools invites it to try anyway and end the turn on a
        // tool result with no text.
        { ...opts, messages: opts.messages },
        isFinalIteration ? [] : tools,
        hasYielded
      ),
      () => {
        hasYielded = true;
      }
    );

    if (turn.failed) return;
    if (turn.parsedToolCalls.length === 0) return;

    logger.info(`[${opts.logLabel}/Stream] Tool round`, {
      iteration,
      calls: turn.parsedToolCalls.map((c) => c.name)
    });

    opts.messages.push({
      role: "assistant",
      // Chat Completions rejects an empty string here; null is the "tool call only,
      // no prose" form.
      content: turn.text || null,
      tool_calls: turn.rawToolCalls
    });

    const results: CompletedToolCall[] = [];
    yield* runToolCalls(turn.parsedToolCalls, catalog, opts.toolContext!, results);

    for (const result of results) {
      opts.messages.push(chatCompletionsToolResult(result.callId, result.content));
    }

    if (isFinalIteration) {
      // Reached only if the model called a tool on the final iteration despite the
      // empty tool list — rare, but it would otherwise end the turn silently.
      opts.messages.push({ role: "system", content: TOOL_BUDGET_EXHAUSTED_NOTE });
    }
  }
}

/**
 * Pass a generator's events through while noting whether any text was emitted.
 *
 * Needed because `yield*` forwards events without giving the caller a chance to
 * observe them, and the retry logic must know whether output has already been
 * committed to the client.
 */
async function* wrapYieldTracking<TReturn>(
  source: AsyncGenerator<StreamEvent, TReturn, unknown>,
  onText: () => void
): AsyncGenerator<StreamEvent, TReturn, unknown> {
  while (true) {
    const next = await source.next();
    if (next.done) return next.value;
    if (next.value.type === "text") onText();
    yield next.value;
  }
}
