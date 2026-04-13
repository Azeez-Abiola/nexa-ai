import { Redis } from "ioredis";
import logger from "../utils/logger";

const MAX_RETRIES = 3;

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  connectTimeout: 5000,
  lazyConnect: !process.env.REDIS_HOST,
  retryStrategy: (times) => {
    if (times > MAX_RETRIES) {
      logger.warn(`[Redis] Giving up after ${MAX_RETRIES} attempts — document processing workers disabled`);
      return null;
    }
    const delay = Math.min(times * 500, 3000);
    logger.info(`[Redis] Retrying connection in ${delay}ms (attempt ${times}/${MAX_RETRIES})`);
    return delay;
  }
});

redisConnection.on("error", () => {
  // Silenced — retryStrategy handles logging
});

redisConnection.on("connect", () => {
  logger.info("[Redis] Connected");
});

export { redisConnection };
