/**
 * Simple in-process rate limiter using a sliding window.
 * For production at scale, replace with Upstash Redis:
 * https://github.com/upstash/ratelimit
 *
 * Usage:
 *   const result = await rateLimit("auth", ip, { limit: 10, windowMs: 60_000 })
 *   if (!result.success) return tooManyRequests()
 */

interface Window {
  count:     number;
  resetAt:   number;
}

// In-memory store — wiped on cold start (acceptable for serverless)
const store = new Map<string, Window>();

// Clean up expired entries every 5 minutes to prevent memory bloat
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of store.entries()) {
    if (window.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

interface Options {
  limit:    number;  // max requests
  windowMs: number;  // window size in ms
}

interface Result {
  success:   boolean;
  remaining: number;
  resetAt:   number;
}

export function rateLimit(
  namespace: string,
  identifier: string,
  options: Options
): Result {
  const key = `${namespace}:${identifier}`;
  const now = Date.now();

  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    // New or expired window
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { success: true, remaining: options.limit - 1, resetAt: now + options.windowMs };
  }

  existing.count += 1;

  if (existing.count > options.limit) {
    return { success: false, remaining: 0, resetAt: existing.resetAt };
  }

  return {
    success:   true,
    remaining: options.limit - existing.count,
    resetAt:   existing.resetAt,
  };
}

/** Extract the real client IP from Next.js request headers */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

/**
 * Pre-configured rate limiters for common endpoints.
 * Adjust limits based on your expected traffic.
 */
export const limiters = {
  /** Login — 10 attempts per IP per 15 minutes */
  auth: (ip: string) =>
    rateLimit("auth", ip, { limit: 10, windowMs: 15 * 60 * 1000 }),

  /** Register — 5 new accounts per IP per hour */
  register: (ip: string) =>
    rateLimit("register", ip, { limit: 5, windowMs: 60 * 60 * 1000 }),

  /** Password reset request — 3 per IP per hour (prevent email bombing) */
  passwordReset: (ip: string) =>
    rateLimit("password-reset", ip, { limit: 3, windowMs: 60 * 60 * 1000 }),

  /** Checkout — 5 checkout attempts per student per 10 minutes */
  checkout: (userId: string) =>
    rateLimit("checkout", userId, { limit: 5, windowMs: 10 * 60 * 1000 }),

  /** General API — 100 per IP per minute */
  api: (ip: string) =>
    rateLimit("api", ip, { limit: 100, windowMs: 60 * 1000 }),
};
