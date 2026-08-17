import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring in production
  // Increase to 1.0 during initial rollout to see full picture, then dial back
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture 100% of sessions that have an error
  replaysOnErrorSampleRate: 1.0,

  // Capture 1% of all sessions for session replay
  replaysSessionSampleRate: 0.01,

  // Don't send events in development unless DSN is explicitly set
  enabled: process.env.NODE_ENV === "production" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Browser extensions
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Network errors outside our control
    "NetworkError when attempting to fetch resource",
    "Failed to fetch",
    "Load failed",
    // Next.js router cancelled navigations (not real errors)
    "Abort route change",
  ],

  beforeSend(event, hint) {
    // Strip sensitive fields from request data before sending to Sentry
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      const sensitiveFields = ["password", "passwordHash", "token", "recaptchaToken", "secret"];
      sensitiveFields.forEach((field) => {
        if (field in data) data[field] = "[Filtered]";
      });
    }
    return event;
  },
});
