import { Redis } from "ioredis";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import jwt from "jsonwebtoken";
import { Request } from "express";
import logger from "../utils/logger";

// Dedicated Redis client — separate from the BullMQ connection which requires
// maxRetriesPerRequest: null (a BullMQ-specific option that causes short-lived
// rate-limit commands to hang instead of failing fast).
// maxRetriesPerRequest/commandTimeout are deliberately tight: this store backs the login
// rate limiter, which must fail FAST (see makeStore below) rather than let a slow/unreachable
// Redis leave a request hanging for the default ~20-retry queue (that's what produced silent
// timeouts under real testing instead of a clean block-or-allow decision).
const rateLimitRedis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      enableReadyCheck: false,
      connectTimeout: 10000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    })
  : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD || undefined,
      enableReadyCheck: false,
      connectTimeout: 10000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

rateLimitRedis.on("error", (err) => {
  logger.warn("[RateLimit Redis] Connection error", { message: err.message });
});
rateLimitRedis.on("connect", () => {
  logger.info("[RateLimit Redis] Connected");
});

// Marks an error as originating from the rate-limit Redis store so the global error handler
// (index.ts) can fail CLOSED with a clean 503 instead of falling through to Express's default
// error page — an unreachable/slow Redis must never silently let a login attempt through
// unthrottled, since that's exactly the brute-force protection this store exists to provide.
class RateLimitStoreError extends Error {
  isRateLimitStoreError = true;
}

function makeStore(prefix: string) {
  return new RedisStore({
    sendCommand: async (...args: string[]) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (await rateLimitRedis.call(...(args as [string, ...string[]]))) as any;
      } catch (err) {
        logger.error("[RateLimit Redis] Command failed — failing closed", {
          prefix,
          message: (err as Error).message,
        });
        throw new RateLimitStoreError("Rate limit store unavailable");
      }
    },
    prefix,
  });
}

// Extract userId from a bearer token without signature verification — used only
// for rate-limit bucketing. Authorization is still enforced by authMiddleware downstream.
function extractUserId(req: Request): string | null {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return null;
    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    const id = decoded?.userId ?? decoded?.adminId;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

function aiKeyGenerator(req: Request): string {
  const userId = extractUserId(req);
  return userId ? `user:${userId}` : (req.ip ?? "unknown");
}

const sharedOptions = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  skip: (req: Request) => req.method === "OPTIONS",
} as const;

// The only requests that should count against the AI message quota: actual
// message generations. Everything else on the conversations/chat routers
// (listing conversations, folders, mentions, sharing, suggestions, reads) must
// NOT consume the budget, otherwise simply opening the app exhausts the limit.
const AI_MESSAGE_PATHS: RegExp[] = [
  /^\/api\/v1\/chat\/?$/,
  /^\/api\/v1\/chat\/public(\/stream)?\/?$/,
  /^\/api\/v1\/conversations\/[^/]+\/message(-stream)?\/?$/,
  /^\/api\/v1\/conversations\/[^/]+\/message\/[^/]+\/edit\/?$/,
];

// Skip the AI limiters unless this is a POST to a message-generating endpoint.
function skipNonAiMessage(req: Request): boolean {
  if (req.method !== "POST") return true;
  const pathname = req.originalUrl.split("?")[0];
  return !AI_MESSAGE_PATHS.some((re) => re.test(pathname));
}

const AUTH_LIMIT = parseInt(process.env.RATE_LIMIT_AUTH ?? "10", 10);
// Short-window burst guard (per user). Kept generous so it only trips on abuse,
// never during normal back-and-forth chatting.
const AI_LIMIT_PER_MINUTE = parseInt(process.env.RATE_LIMIT_AI_PER_MINUTE ?? "30", 10);
// The user-facing prompt budget: 50 prompts per user per day. This is the number
// surfaced by the RateLimitBanner. Keyed per user (see aiKeyGenerator), not per model.
const AI_LIMIT_PER_DAY = parseInt(process.env.RATE_LIMIT_AI_PER_DAY ?? "50", 10);

// authLimiter is mounted on the whole /api/v1/auth and /api/v1/admin/auth
// routers, but it must only guard the unauthenticated, brute-forceable
// endpoints (login/OTP/password reset). Everything else on those routers
// (invite-employee, user management, etc.) already requires a valid admin
// token via adminAuthMiddleware, so it shouldn't share the login IP bucket.
const AUTH_SENSITIVE_PATHS: RegExp[] = [
  /\/login\/?$/,
  /\/login\/verify-otp\/?$/,
  /\/verify-email\/?$/,
  /\/resend-verification\/?$/,
  /\/forgot-password\/?$/,
  /\/reset-password\/?$/,
  /\/request-access\/?$/,
  /\/request-access\/verify-otp\/?$/,
];

function skipNonAuthSensitive(req: Request): boolean {
  if (req.method !== "POST") return true;
  const pathname = req.originalUrl.split("?")[0];
  return !AUTH_SENSITIVE_PATHS.some((re) => re.test(pathname));
}

// Brute-force protection on login/OTP/password-reset endpoints — AUTH_LIMIT req per 15 min per IP.
// This IS a security control, so it fails CLOSED (passOnStoreError: false, the default — kept
// explicit here for clarity): if Redis is unreachable, the global error handler in index.ts
// returns 503 rather than letting brute-force attempts through uncounted.
export const authLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 15 * 60 * 1000,
  limit: AUTH_LIMIT,
  keyGenerator: (req) => req.ip ?? "unknown",
  skip: skipNonAuthSensitive,
  passOnStoreError: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  store: makeStore("rl:auth:"),
});

// AI burst control — AI_LIMIT_PER_MINUTE messages per minute per user.
// Unlike authLimiter, this is a usage/cost cap, not a security control — if Redis is
// unreachable we fail OPEN (let the message through uncounted) rather than break chat,
// the app's core function, over a transient Redis blip. The failure is still logged
// inside makeStore()'s sendCommand for visibility.
export const aiLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 1000,
  limit: AI_LIMIT_PER_MINUTE,
  keyGenerator: aiKeyGenerator,
  skip: skipNonAiMessage,
  passOnStoreError: true,
  message: { error: "Too many requests. Please wait a moment before sending another message." },
  store: makeStore("rl:ai:"),
});

// AI daily cap — AI_LIMIT_PER_DAY messages per day per user. Same fail-open reasoning as aiLimiter.
export const aiDailyLimiter = rateLimit({
  ...sharedOptions,
  windowMs: 24 * 60 * 60 * 1000,
  limit: AI_LIMIT_PER_DAY,
  keyGenerator: aiKeyGenerator,
  skip: skipNonAiMessage,
  passOnStoreError: true,
  store: makeStore("rl:ai-daily:"),
  handler: (_req, res) => {
    res.status(429).json({
      error: "You've reached your daily message limit. Please try again tomorrow.",
    });
  },
});
