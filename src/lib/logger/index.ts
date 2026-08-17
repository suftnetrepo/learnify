import winston from "winston";

const { combine, timestamp, errors, json, colorize, simple } = winston.format;
// suppress unused warning
void combine;

const isDev = process.env.NODE_ENV === "development";

export const logger = winston.createLogger({
  level: isDev ? "debug" : "info",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: "learnify" },
  transports: [
    new winston.transports.Console({
      format: isDev ? combine(colorize(), simple()) : json(),
    }),
    // In production, add file transports or third-party (Sentry, DataDog)
    // new winston.transports.File({ filename: "logs/error.log", level: "error" }),
  ],
});

// Convenience helpers
export const log = {
  info: (message: string, meta?: object) => logger.info(message, meta),
  warn: (message: string, meta?: object) => logger.warn(message, meta),
  error: (message: string, meta?: object) => logger.error(message, meta),
  debug: (message: string, meta?: object) => logger.debug(message, meta),
};
