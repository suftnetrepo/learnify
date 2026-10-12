/**
 * Test doubles for the whiteboard API tests. The fake db is a chainable stand-in for the
 * Drizzle query builder: every chain (db.select().from()...where()) resolves, when awaited,
 * to the next queued result. Tests queue results in the order the route/service awaits them,
 * so the real route, service and access code all run — only Postgres is replaced.
 */
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

interface Call { method: string; args: unknown[] }

function createFakeDb() {
  const results: unknown[] = [];
  const calls:   Call[]    = [];

  const chain = (): unknown => {
    const handler: ProxyHandler<() => void> = {
      get(_target, prop) {
        if (prop === "then") {
          const value = results.length > 0 ? results.shift() : [];
          return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve(value).then(resolve, reject);
        }
        return (...args: unknown[]) => { calls.push({ method: String(prop), args }); return proxy; };
      },
    };
    const proxy: unknown = new Proxy(() => {}, handler);
    return proxy;
  };

  const db: unknown = new Proxy({}, {
    get(_target, prop) {
      if (prop === "transaction") return async (cb: (tx: unknown) => unknown) => cb(db);
      return (...args: unknown[]) => { calls.push({ method: String(prop), args }); return chain(); };
    },
  });

  return {
    db,
    calls,
    /** Results for the next awaited queries, in order. Unqueued queries resolve to []. */
    queue: (...rows: unknown[]) => { results.push(...rows); },
    reset: () => { results.length = 0; calls.length = 0; },
    /** Arguments of every call to a builder method, e.g. argsOf("set") */
    argsOf: (method: string) => calls.filter((c) => c.method === method).map((c) => c.args),
  };
}

/** Singleton shared by vi.mock("@/db") factories and the tests. */
export const fakeDb = createFakeDb();

const dialect = new PgDialect();
/** Renders a Drizzle condition (as passed to .where()) to SQL text + params. */
export function renderSql(condition: unknown): { sql: string; params: unknown[] } {
  return dialect.sqlToQuery(condition as SQL);
}

// ─── Requests ──────────────────────────────────────────────────────────────────

export function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    body:    body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

export async function readJson(res: Response): Promise<{ success: boolean; data: unknown; code?: string; errors?: Record<string, string[]> }> {
  return res.json();
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export const IDS = {
  student:  "11111111-1111-4111-8111-111111111111",
  student2: "11111111-1111-4111-8111-222222222222",
  tutor:    "33333333-3333-4333-8333-333333333333",
  admin:    "44444444-4444-4444-8444-444444444444",
  board:    "55555555-5555-4555-8555-555555555555",
  course:   "66666666-6666-4666-8666-666666666666",
  session:  "77777777-7777-4777-8777-777777777777",
};

export function sessionUser(id: string, role: "student" | "tutor" | "admin") {
  return { user: { id, role, name: "Test User", email: "t@example.com", status: "active" }, expires: "2099-01-01" };
}

export function boardRow(overrides: Record<string, unknown> = {}) {
  return {
    id:        IDS.board,
    ownerId:   IDS.student,
    title:     "Board",
    mode:      "individual",
    courseId:  null,
    lectureId: null,
    sceneData: null,
    version:   1,
    isDeleted: false,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...overrides,
  };
}

/** What WhiteboardService.findById's join query returns for one board. */
export const findByIdResult = (overrides: Record<string, unknown> = {}) =>
  [{ whiteboard: boardRow(overrides), courseTitle: null }];

/** What WhiteboardSessionService.findById's first query returns. */
export function sessionQueryRow(overrides: Record<string, unknown> = {}) {
  return {
    id:                 IDS.session,
    whiteboardId:       IDS.board,
    hostId:             IDS.tutor,
    status:             "active",
    courseSessionId:    null,
    startedAt:          new Date("2026-10-12T09:00:00Z"),
    endedAt:            null,
    whiteboardTitle:    "Board",
    whiteboardOwnerId:  IDS.tutor,
    boardCourseId:      IDS.course,
    sessionCourseId:    null,
    courseSessionTitle: null,
    ...overrides,
  };
}

/** Queues both queries WhiteboardSessionService.findById runs (session row, then course title). */
export function queueSessionFind(overrides: Record<string, unknown> = {}) {
  fakeDb.queue([sessionQueryRow(overrides)], [{ title: "Algebra 101" }]);
}

/** Decodes a JWT's payload without verifying it. */
export function decodeJwt(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
}
