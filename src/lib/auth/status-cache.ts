/**
 * In-process cache of each user's auth-relevant state (role/status/deleted),
 * consulted by the NextAuth `jwt` callback on every session read.
 *
 * - Concurrent lookups for the same user share one DB query (proxy, layout and
 *   page all call `auth()` for a single navigation).
 * - UserService invalidates entries on status/role changes and deletes, so a
 *   suspension made through the app takes effect on the very next request.
 * - The TTL bounds staleness for changes made elsewhere (other instances,
 *   direct DB edits). For multi-instance deployments, move this to Redis.
 *
 * Stored on globalThis because Next bundles proxy and route handlers
 * separately — a module-level Map would give each its own copy, and an
 * invalidation from an API route would never reach the proxy.
 */
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const TTL_MS = 30_000;
// During a database/network incident, briefly share the rejected lookup across
// requests. Auth fails open, but this prevents every component and API call from
// immediately opening another database connection attempt.
const FAILURE_TTL_MS = 10_000;

export type AuthState =
  | { revoked: true }
  | { revoked: false; role: string; status: string };

interface Entry {
  value:     Promise<AuthState>;
  expiresAt: number;
}

const globalStore = globalThis as typeof globalThis & { __authStatusCache?: Map<string, Entry> };
const store = (globalStore.__authStatusCache ??= new Map<string, Entry>());

async function load(userId: string): Promise<AuthState> {
  const [row] = await db
    .select({ role: users.role, status: users.status, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || row.deletedAt || row.status === "suspended") return { revoked: true };
  return { revoked: false, role: row.role as string, status: row.status as string };
}

export function getAuthState(userId: string): Promise<AuthState> {
  const now = Date.now();
  const hit = store.get(userId);
  if (hit && hit.expiresAt > now) return hit.value;

  const value = load(userId);
  store.set(userId, { value, expiresAt: now + TTL_MS });
  // Keep failures only long enough to suppress a connection retry storm.
  value.catch(() => {
    const current = store.get(userId);
    if (current?.value === value) current.expiresAt = Date.now() + FAILURE_TTL_MS;
  });
  return value;
}

export function invalidateAuthState(userId: string): void {
  store.delete(userId);
}

// Drop expired entries so the map doesn't grow with every user ever seen.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt < now) store.delete(key);
  }
}, 5 * 60 * 1000).unref?.();
