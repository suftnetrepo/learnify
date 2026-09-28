/**
 * Browser error monitoring (Sentry). Next 16 loads this file in the browser before the app
 * starts — it replaces the old sentry.client.config.ts, which Next 16/Turbopack no longer loads.
 *
 * Off until NEXT_PUBLIC_SENTRY_DSN is set. That value is inlined at build time, so set it in
 * Render's environment and redeploy. The SDK (~75 KB gzipped on every page) is only downloaded
 * when a DSN is configured — with the empty placeholder, pages don't pay for it.
 */
type SentryModule = typeof import("@sentry/nextjs");
let sentry: SentryModule | null = null;

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  void import("@sentry/nextjs").then((Sentry) => {
    sentry = Sentry;
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

      // Capture 10% of transactions for performance monitoring in production
      // Increase to 1.0 during initial rollout to see full picture, then dial back
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

      // Session replay isn't set up (it needs replayIntegration and adds ~50 KB); errors + traces only

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

      beforeSend(event) {
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
  });
}

// Traces client-side navigations between pages (a no-op until Sentry has loaded)
export const onRouterTransitionStart: SentryModule["captureRouterTransitionStart"] = (...args) =>
  sentry?.captureRouterTransitionStart(...args);
