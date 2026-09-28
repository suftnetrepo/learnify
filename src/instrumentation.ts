import * as Sentry from "@sentry/nextjs";

/**
 * Server start-up hook (Next 16): loads Sentry for the Node.js and Edge runtimes. Without this
 * file sentry.server.config.ts / sentry.edge.config.ts were never loaded, so server errors
 * weren't reported. Browser monitoring lives in src/instrumentation-client.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge")   await import("../sentry.edge.config");
}

/** Reports errors thrown while rendering pages / running route handlers and server actions. */
export const onRequestError = Sentry.captureRequestError;
