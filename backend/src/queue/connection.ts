import { Redis } from "ioredis";
import logger from "../utils/logger";

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  // Required by BullMQ — do not set a retry limit on commands
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Add a connection timeout to fail faster if Redis is missing
  connectTimeout: 5000,
  retryStrategy: (times) => {
    // Keep retrying with exponential backoff, capped at 10 seconds
    const delay = Math.min(times * 200, 10000);
    logger.info(`[Redis] Retrying connection in ${delay}ms (attempt ${times})`);
    return delay;
  }
});

redisConnection.on("error", (err) => {
  logger.error("[Redis] Connection error", { error: err.message });
});

redisConnection.on("connect", () => {
  logger.info("[Redis] Connected");
});

export { redisConnection };
