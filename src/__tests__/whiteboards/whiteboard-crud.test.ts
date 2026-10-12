import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", async () => ({ db: (await import("./helpers")).fakeDb.db }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/access/course", () => ({ requireCourseAccess: vi.fn(async () => false) }));

import { auth } from "@/lib/auth";
import { GET as listBoards, POST as createBoard } from "@/app/api/whiteboards/route";
import { GET as getBoard, PATCH as patchBoard, DELETE as deleteBoard } from "@/app/api/whiteboards/[id]/route";
import {
  fakeDb, renderSql, jsonRequest, params, readJson, IDS, sessionUser, boardRow, findByIdResult,
} from "./helpers";

const signIn = (id: string, role: "student" | "tutor" | "admin") =>
  vi.mocked(auth).mockResolvedValue(sessionUser(id, role) as never);

beforeEach(() => {
  fakeDb.reset();
  vi.mocked(auth).mockReset();
});

describe("GET /api/whiteboards", () => {
  it("returns only the signed-in user's non-deleted boards", async () => {
    signIn(IDS.student, "student");
    const rows = [{ ...boardRow(), courseTitle: null }];
    fakeDb.queue(rows);

    const res  = await listBoards(jsonRequest("/api/whiteboards", "GET"));
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    const where = renderSql(fakeDb.argsOf("where")[0][0]);
    expect(where.sql).toContain('"whiteboards"."owner_id" = $1');
    expect(where.sql).toContain('"whiteboards"."is_deleted" = $2');
    expect(where.params).toEqual([IDS.student, false]);
  });

  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const res = await listBoards(jsonRequest("/api/whiteboards", "GET"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/whiteboards", () => {
  it("creates a board owned by the session user and returns it", async () => {
    signIn(IDS.student, "student");
    const created = boardRow({ title: "Fractions" });
    fakeDb.queue([created]);

    // ownerId in the body must be ignored — owner always comes from the session
    const res  = await createBoard(jsonRequest("/api/whiteboards", "POST", { title: "Fractions", ownerId: IDS.tutor }));
    const body = await readJson(res);

    expect(res.status).toBe(201);
    expect(body.data).toMatchObject({ id: IDS.board, title: "Fractions" });
    expect(fakeDb.argsOf("values")[0][0]).toMatchObject({ ownerId: IDS.student, title: "Fractions", mode: "individual" });
  });

  it("rejects a missing title", async () => {
    signIn(IDS.student, "student");
    const res = await createBoard(jsonRequest("/api/whiteboards", "POST", {}));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/whiteboards/[id]", () => {
  it("refuses a requester who is neither the owner nor a tutor/admin (404, not 403 — existence isn't revealed)", async () => {
    signIn(IDS.student2, "student");
    fakeDb.queue(findByIdResult({ ownerId: IDS.student }));

    const res = await getBoard(jsonRequest(`/api/whiteboards/${IDS.board}`, "GET"), params({ id: IDS.board }));
    expect(res.status).toBe(404);
  });

  it("lets a tutor read any board, read-only", async () => {
    signIn(IDS.tutor, "tutor");
    fakeDb.queue(findByIdResult({ ownerId: IDS.student }));

    const res  = await getBoard(jsonRequest(`/api/whiteboards/${IDS.board}`, "GET"), params({ id: IDS.board }));
    const body = await readJson(res);
    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({ canEdit: false });
  });
});

describe("PATCH /api/whiteboards/[id]", () => {
  const url = `/api/whiteboards/${IDS.board}`;

  it("increments the version on success", async () => {
    signIn(IDS.student, "student");
    fakeDb.queue(
      findByIdResult({ version: 3 }),            // route: load + access check
      findByIdResult({ version: 3 }),            // service: version pre-check
      [boardRow({ version: 4, title: "Renamed" })], // UPDATE ... RETURNING
    );

    const res  = await patchBoard(jsonRequest(url, "PATCH", { version: 3, title: "Renamed" }), params({ id: IDS.board }));
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({ version: 4 });
    expect(fakeDb.argsOf("set")[0][0]).toMatchObject({ title: "Renamed", version: 4 });
  });

  it("returns 409 with the current version when the version doesn't match", async () => {
    signIn(IDS.student, "student");
    fakeDb.queue(findByIdResult({ version: 5 }), findByIdResult({ version: 5 }));

    const res  = await patchBoard(jsonRequest(url, "PATCH", { version: 3, title: "Stale" }), params({ id: IDS.board }));
    const body = await readJson(res);

    expect(res.status).toBe(409);
    expect(body.errors?.version).toEqual(["5"]);
    expect(fakeDb.argsOf("set")).toHaveLength(0);
  });

  it("returns 413 when sceneData exceeds 10 MB", async () => {
    signIn(IDS.student, "student");
    const big = { elements: [], pad: "x".repeat(10 * 1024 * 1024 + 100 * 1024) };

    const res = await patchBoard(jsonRequest(url, "PATCH", { version: 1, sceneData: big }), params({ id: IDS.board }));
    expect(res.status).toBe(413);
    expect(fakeDb.calls).toHaveLength(0);   // rejected before any query
  });

  it("forbids a tutor from modifying a student's individual board", async () => {
    signIn(IDS.tutor, "tutor");
    fakeDb.queue(findByIdResult({ ownerId: IDS.student }));

    const res = await patchBoard(jsonRequest(url, "PATCH", { version: 1, title: "Nope" }), params({ id: IDS.board }));
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/whiteboards/[id]", () => {
  it("soft-deletes by setting is_deleted = true", async () => {
    signIn(IDS.student, "student");
    fakeDb.queue(findByIdResult(), []);

    const res = await deleteBoard(jsonRequest(`/api/whiteboards/${IDS.board}`, "DELETE"), params({ id: IDS.board }));

    expect(res.status).toBe(200);
    expect(fakeDb.argsOf("delete")).toHaveLength(0);   // never a hard delete
    expect(fakeDb.argsOf("set")[0][0]).toMatchObject({ isDeleted: true });
  });
});
