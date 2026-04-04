import { Redis } from "ioredis";
import logger from "../utils/logger";

const redisConnection = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  // Required by BullMQ — do not set a retry limit on commands
  maxRetriesPerRequest: null,
  enableReadyCheck: false
});

redisConnection.on("error", (err) => {
  logger.error("[Redis] Connection error", { error: err.message });
});

redisConnection.on("connect", () => {
  logger.info("[Redis] Connected");
});

export { redisConnection };
