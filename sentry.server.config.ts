import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === "production" || !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Server-specific: add user context to errors where available
  beforeSend(event, hint) {
    // Never send password hashes, tokens, or credentials to Sentry
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      const sensitiveFields = [
        "password", "passwordHash", "passwordResetToken",
        "token", "recaptchaToken", "secret", "authorization",
        "STRIPE_SECRET_KEY", "CLOUDINARY_API_SECRET",
      ];
      sensitiveFields.forEach((field) => {
        if (field in data) data[field] = "[Filtered]";
      });
    }

    // Strip auth headers
    if (event.request?.headers) {
      const headers = event.request.headers as Record<string, string>;
      if (headers["authorization"]) headers["authorization"] = "[Filtered]";
      if (headers["cookie"])        headers["cookie"]        = "[Filtered]";
    }

    return event;
  },
});
