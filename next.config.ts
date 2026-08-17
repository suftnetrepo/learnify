import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // ── Images ──────────────────────────────────────────────────────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'none'; script-src 'none'; sandbox;",
  },

  // ── Security headers ────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-Content-Type-Options",     value: "nosniff" },
          { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://widget.cloudinary.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://res.cloudinary.com https://*.cloudinary.com https://images.unsplash.com",
              "media-src 'self' https://res.cloudinary.com https://*.cloudinary.com blob:",
              "connect-src 'self' https://api.cloudinary.com https://api.stripe.com https://o*.ingest.sentry.io",
              "frame-src https://js.stripe.com https://hooks.stripe.com",
            ].join("; "),
          },
        ],
      },
      // Stripe webhook — needs raw body, disable body parser via route config
      {
        source: "/api/webhooks/stripe",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },

  // ── Redirects ───────────────────────────────────────────────────────────────
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      { source: "/signin", destination: "/login", permanent: true },
      { source: "/signup", destination: "/register", permanent: true },
    ];
  },

  // ── Logging ─────────────────────────────────────────────────────────────────
  logging: { fetches: { fullUrl: process.env.NODE_ENV === "development" } },

  // ── Bundle analysis (enable with ANALYZE=true) ───────────────────────────
  // Install @next/bundle-analyzer if needed
};

const sentryConfig = {
  // Suppresses source map upload logs in CI
  silent: true,

  // Upload source maps to Sentry for readable stack traces in production
  // Requires SENTRY_AUTH_TOKEN env var — get from Sentry > Settings > Auth Tokens
  org:     process.env.SENTRY_ORG     ?? "learnify",
  project: process.env.SENTRY_PROJECT ?? "learnify-web",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Capture React component display names for better error messages
  reactComponentAnnotation: { enabled: true },

  // Tunnel Sentry requests through your own domain to avoid ad-blockers
  tunnelRoute: "/monitoring",

  // Hide source maps from the browser in production
  hideSourceMaps: true,

  // Auto-instrument Vercel Cron jobs
  automaticVercelMonitors: true,
};

export default withSentryConfig(nextConfig, sentryConfig);
