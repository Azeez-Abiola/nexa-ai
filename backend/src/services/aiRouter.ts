import * as openai from "./openaiService";
import * as claude from "./claudeService";
import * as kimiService from "./kimiService";
import * as deepseekService from "./deepseekService";
import { labelForModelId } from "../config/modelLabels";
import { classifyProviderError, reportProviderFailure } from "./providerHealth";
import logger from "../utils/logger";

export type AIModel = "gpt" | "claude" | "kimi" | "deepseek";

export function parseModel(raw: unknown): AIModel {
  if (raw === "claude") return "claude";
  if (raw === "kimi") return "kimi";
  if (raw === "deepseek") return "deepseek";
  return "gpt";
}

function rawStreamAIResponse(model: AIModel) {
  if (model === "claude") return claude.streamAIResponse;
  if (model === "kimi") return kimiService.streamAIResponse;
  if (model === "deepseek") return deepseekService.streamAIResponse;
  return openai.streamAIResponse;
}

function rawGenerateAIResponse(model: AIModel) {
  if (model === "claude") return claude.generateAIResponse;
  if (model === "kimi") return kimiService.generateAIResponse;
  if (model === "deepseek") return deepseekService.generateAIResponse;
  return openai.generateAIResponse;
}

// ─── Failover ─────────────────────────────────────────────────────────────────

/** Env var holding each provider's credentials — absent/empty means unusable. */
const PROVIDER_KEY_ENV: Record<AIModel, string> = {
  gpt: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  kimi: "KIMI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

/** Order fallbacks are tried in, once the requested provider is excluded. */
const FALLBACK_ORDER: AIModel[] = ["gpt", "claude", "deepseek", "kimi"];

function isConfigured(model: AIModel): boolean {
  return Boolean(process.env[PROVIDER_KEY_ENV[model]]);
}

/**
 * The requested provider first, then any other configured provider.
 *
 * Failover exists because a dead provider (exhausted credit, bad key) would
 * otherwise surface to the user as an error while three other models sit idle.
 */
function failoverChain(model: AIModel): AIModel[] {
  return [model, ...FALLBACK_ORDER.filter((m) => m !== model && isConfigured(m))];
}

type StreamArgs = Parameters<ReturnType<typeof rawStreamAIResponse>>;
type GenerateArgs = Parameters<ReturnType<typeof rawGenerateAIResponse>>;

/**
 * Streaming entry point with provider failover.
 *
 * Failover is only possible before the first chunk reaches the client — once text
 * has been streamed we cannot rewind it, so a mid-stream failure is rethrown.
 * In practice quota/auth failures happen on the first request, before any output.
 */
export function getStreamAIResponse(model: AIModel) {
  return async function* (...args: StreamArgs): AsyncGenerator<string, void, unknown> {
    const chain = failoverChain(model);
    let lastError: unknown;

    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i];
      const isLast = i === chain.length - 1;
      let yieldedAny = false;

      try {
        for await (const chunk of rawStreamAIResponse(provider)(...args)) {
          yieldedAny = true;
          yield chunk;
        }
        if (i > 0) {
          logger.info("[AIRouter] Served by fallback provider", { requested: model, servedBy: provider });
        }
        return;
      } catch (err) {
        lastError = err;

        // Already streamed content — switching now would corrupt the answer.
        if (yieldedAny) throw err;

        const failure = classifyProviderError(err);
        const next = failure.failover && !isLast ? chain[i + 1] : undefined;
        void reportProviderFailure({
          provider,
          modelId: getModelId(provider),
          failure,
          failedOverTo: next,
        });

        if (!next) throw err;
      }
    }

    throw lastError;
  };
}

/** Non-streaming entry point with the same failover behaviour. */
export function getGenerateAIResponse(model: AIModel) {
  return async function (...args: GenerateArgs): Promise<string> {
    const chain = failoverChain(model);
    let lastError: unknown;

    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i];
      const isLast = i === chain.length - 1;

      try {
        const result = await rawGenerateAIResponse(provider)(...args);
        if (i > 0) {
          logger.info("[AIRouter] Served by fallback provider", { requested: model, servedBy: provider });
        }
        return result;
      } catch (err) {
        lastError = err;
        const failure = classifyProviderError(err);
        const next = failure.failover && !isLast ? chain[i + 1] : undefined;
        void reportProviderFailure({
          provider,
          modelId: getModelId(provider),
          failure,
          failedOverTo: next,
        });

        if (!next) throw err;
      }
    }

    throw lastError;
  };
}

/** The model id actually in use for this provider (env-resolved, same value the service sends). */
export function getModelId(model: AIModel): string {
  if (model === "claude") return claude.MODEL;
  if (model === "kimi") return kimiService.MODEL;
  if (model === "deepseek") return deepseekService.MODEL;
  return openai.MODEL;
}

/**
 * Human-readable label for the model actually configured for this provider.
 * Derived from the real (env-resolved) model id rather than hardcoded, so what the
 * assistant reports about itself cannot drift from what is really answering.
 */
export function getModelLabel(model: AIModel): string {
  return labelForModelId(getModelId(model));
}
