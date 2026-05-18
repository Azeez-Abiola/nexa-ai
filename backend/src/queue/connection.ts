import { Redis } from "ioredis";
import logger from "../utils/logger";

const MAX_RETRIES = 3;

const retryStrategy = (times: number) => {
  if (times > MAX_RETRIES) {
    logger.warn(`[Redis] Giving up after ${MAX_RETRIES} attempts — document processing workers disabled`);
    return null;
  }
  const delay = Math.min(times * 500, 3000);
  logger.info(`[Redis] Retrying connection in ${delay}ms (attempt ${times}/${MAX_RETRIES})`);
  return delay;
};

const redisConnection = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10000,
      retryStrategy
    })
  : new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 10000,
      lazyConnect: !process.env.REDIS_HOST,
      retryStrategy
    });

redisConnection.on("error", () => {
  // Silenced — retryStrategy handles logging
});

redisConnection.on("connect", () => {
  logger.info("[Redis] Connected");
});

export { redisConnection };
