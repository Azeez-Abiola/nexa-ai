import winston from "winston";
import path from "path";

const { combine, timestamp, errors, json, simple } = winston.format;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    timestamp(),
    errors({ stack: true }),
    json()
  ),
  transports: [
    new winston.transports.Console({
      format: combine(timestamp(), simple())
    }),
    new winston.transports.File({
      filename: path.join("logs", "error.log"),
      level: "error"
    }),
    new winston.transports.File({
      filename: path.join("logs", "combined.log")
    })
  ]
});

export default logger;
