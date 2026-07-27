import { redisConnection } from "../queue/connection";
import { sendProviderOutageAlert } from "./emailService";
import logger from "../utils/logger";

/**
 * Classification of provider failures, and admin alerting for the ones a human
 * has to fix.
 *
 * The important distinction is between the two flavours of 429:
 *   - `quota`      — credit/quota exhausted. Permanent until someone tops up.
 *                    Failover, and alert.
 *   - `rate_limit` — too many requests per minute. Transient and self-healing.
 *                    Failover, but do NOT alert (it would fire on normal spikes).
 */

export type FailureKind = "quota" | "auth" | "rate_limit" | "server" | "other";

export interface FailureClass {
  kind: FailureKind;
  /** Worth trying a different provider for this request. */
  failover: boolean;
  /** A human has to act — send the ops alert. */
  alert: boolean;
  message: string;
  requestId?: string;
}

/** Alert at most once per provider per window, so an outage can't flood the inbox. */
const ALERT_COOLDOWN_SECONDS = 60 * 60;

/**
 * Longest we will sit waiting on a `retry-after` before giving up on this provider.
 * Beyond this, failing over to another model is faster than waiting.
 */
const MAX_RETRY_DELAY_MS = 10_000;

function readError(err: unknown): { status: number; code: string; message: string; requestId?: string } {
  const e = err as Record<string, any> | null;
  const status = Number(e?.status ?? e?.statusCode ?? 0) || 0;
  const code = String(e?.code ?? e?.error?.code ?? e?.type ?? e?.error?.type ?? "");
  const message = e instanceof Error ? e.message : String(e?.message ?? e ?? "");
  const requestId = e?.requestID ?? e?.request_id ?? e?.requestId;
  return { status, code, message, requestId: requestId ? String(requestId) : undefined };
}

/**
 * Classify a provider error.
 *
 * Note this deliberately does NOT rely on `status` alone: OpenAI's streaming
 * errors arrive with `code`/`type` populated but `status` undefined, so a
 * status-only check misreads every streamed failure.
 */
export function classifyProviderError(err: unknown): FailureClass {
  const { status, code, message, requestId } = readError(err);
  const text = `${code} ${message}`.toLowerCase();

  // Credit/quota exhausted. OpenAI: 429 insufficient_quota. Anthropic: 400 with a
  // "credit balance is too low" body rather than a 429.
  if (
    text.includes("insufficient_quota") ||
    text.includes("exceeded your current quota") ||
    text.includes("credit balance is too low") ||
    text.includes("billing")
  ) {
    return { kind: "quota", failover: true, alert: true, message, requestId };
  }

  if (status === 401 || status === 403 || text.includes("invalid api key") || text.includes("authentication")) {
    return { kind: "auth", failover: true, alert: true, message, requestId };
  }

  if (status === 429 || text.includes("rate_limit") || text.includes("rate limit")) {
    return { kind: "rate_limit", failover: true, alert: false, message, requestId };
  }

  if (status >= 500 || text.includes("server_error") || text.includes("overloaded")) {
    return { kind: "server", failover: true, alert: false, message, requestId };
  }

  // Transport-level blips — no status, but safe to retry.
  if (
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("socket hang up") ||
    text.includes("econnrefused")
  ) {
    return { kind: "server", failover: true, alert: false, message, requestId };
  }

  return { kind: "other", failover: false, alert: false, message, requestId };
}

/** `retry-after` in ms, from either a Headers object or a plain header map. */
function readRetryAfterMs(err: unknown): number | undefined {
  const headers = (err as Record<string, any> | null)?.headers;
  if (!headers) return undefined;

  const raw =
    typeof headers.get === "function"
      ? headers.get("retry-after")
      : headers["retry-after"] ?? headers["Retry-After"];
  if (!raw) return undefined;

  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return seconds * 1000;

  const at = Date.parse(String(raw)); // the header may be an HTTP date
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : undefined;
}

/**
 * Should we retry the SAME provider?
 *
 * Only transient classes qualify — retrying an exhausted quota or a bad key just
 * burns latency before the inevitable failover. If the provider told us to wait
 * longer than MAX_RETRY_DELAY_MS, failing over now beats waiting.
 */
export function isRetryableFailure(err: unknown): boolean {
  const { kind } = classifyProviderError(err);
  if (kind !== "rate_limit" && kind !== "server") return false;

  const retryAfter = readRetryAfterMs(err);
  return retryAfter === undefined || retryAfter <= MAX_RETRY_DELAY_MS;
}

/**
 * How long to wait before the next attempt.
 *
 * Honours the provider's `retry-after` when present — exponential backoff alone
 * (1s, 2s) is far shorter than a per-minute rate-limit window, so retrying on
 * blind backoff usually just fails again.
 */
export function retryDelayMs(err: unknown, attempt: number, baseDelayMs: number): number {
  const backoff = baseDelayMs * Math.pow(2, Math.max(0, attempt - 1));
  const retryAfter = readRetryAfterMs(err);
  if (retryAfter === undefined) return backoff;
  return Math.min(Math.max(retryAfter, backoff), MAX_RETRY_DELAY_MS);
}

/** True if this is the first alert for the provider inside the cooldown window. */
async function claimAlertSlot(provider: string, kind: FailureKind): Promise<boolean> {
  try {
    const key = `provider-alert:${provider}:${kind}`;
    // NX + EX: only the first caller in the window gets the slot.
    const claimed = await redisConnection.set(key, Date.now().toString(), "EX", ALERT_COOLDOWN_SECONDS, "NX");
    return claimed === "OK";
  } catch (err) {
    // Redis being unavailable must not suppress the alert — better a duplicate
    // email than silence during an outage.
    logger.warn("[ProviderHealth] Alert dedupe unavailable, sending anyway", {
      error: (err as Error).message,
    });
    return true;
  }
}

/**
 * Record a provider failure and, when it needs human action, email the ops inbox
 * (at most once per provider per hour).
 *
 * Never throws — alerting must not take down the request path that called it.
 */
export async function reportProviderFailure(opts: {
  provider: string;
  modelId: string;
  failure: FailureClass;
  failedOverTo?: string;
}): Promise<void> {
  const { provider, modelId, failure, failedOverTo } = opts;

  logger.warn("[ProviderHealth] Provider failure", {
    provider,
    modelId,
    kind: failure.kind,
    failover: failure.failover,
    failedOverTo: failedOverTo ?? null,
    requestId: failure.requestId,
    error: failure.message,
  });

  if (!failure.alert) return;

  try {
    if (!(await claimAlertSlot(provider, failure.kind))) return;

    await sendProviderOutageAlert({
      provider,
      modelId,
      kind: failure.kind,
      message: failure.message,
      requestId: failure.requestId,
      failedOverTo,
    });

    logger.info("[ProviderHealth] Outage alert sent", { provider, kind: failure.kind });
  } catch (err) {
    logger.error("[ProviderHealth] Failed to send outage alert", {
      provider,
      error: (err as Error).message,
    });
  }
}
