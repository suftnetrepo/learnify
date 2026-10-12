import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("@/db", async () => ({ db: (await import("./helpers")).fakeDb.db }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/access/course", () => ({ requireCourseAccess: vi.fn(async () => false) }));

import { auth } from "@/lib/auth";
import { requireCourseAccess } from "@/lib/access/course";
import { POST as issueToken } from "@/app/api/whiteboards/sessions/[sessionId]/token/route";
import { fakeDb, jsonRequest, params, readJson, IDS, sessionUser, queueSessionFind, decodeJwt } from "./helpers";

const SECRET = "test-jwt-secret";
const url    = `/api/whiteboards/sessions/${IDS.session}/token`;

const signIn = (id: string, role: "student" | "tutor" | "admin") =>
  vi.mocked(auth).mockResolvedValue(sessionUser(id, role) as never);

async function requestToken() {
  const res  = await issueToken(jsonRequest(url, "POST"), params({ sessionId: IDS.session }));
  const body = await readJson(res);
  const token = (body.data as { token?: string } | null)?.token;
  return { res, token, payload: token ? decodeJwt(token) : null };
}

beforeEach(() => {
  process.env.WHITEBOARD_JWT_SECRET = SECRET;
  fakeDb.reset();
  vi.mocked(auth).mockReset();
  vi.mocked(requireCourseAccess).mockReset().mockResolvedValue(false);
});

describe("POST /api/whiteboards/sessions/[sessionId]/token", () => {
  it("returns 401 when not signed in", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);
    const { res } = await requestToken();
    expect(res.status).toBe(401);
  });

  it("gives an enrolled student role=viewer, canEdit=false", async () => {
    signIn(IDS.student, "student");
    queueSessionFind();
    fakeDb.queue([{ id: "enrollment-1" }], [], []);   // enrolled; no participant row yet; INSERT

    const { res, token, payload } = await requestToken();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({ userId: IDS.student, sessionId: IDS.session, role: "viewer", canEdit: false });
    expect((payload?.exp as number) - (payload?.iat as number)).toBe(4 * 60 * 60);
    // HS256 over header.payload with the shared secret — what the realtime server verifies
    const [h, p, sig] = token!.split(".");
    expect(createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")).toBe(sig);
    expect(fakeDb.argsOf("values")[0][0]).toMatchObject({ userId: IDS.student, role: "viewer", canEdit: false });
  });

  it("keeps drawing access the host already granted to a student", async () => {
    signIn(IDS.student, "student");
    queueSessionFind();
    fakeDb.queue([{ id: "enrollment-1" }], [{ id: "participant-1", canEdit: true }], []);

    const { payload } = await requestToken();
    expect(payload).toMatchObject({ role: "viewer", canEdit: true });
  });

  it("gives an assigned tutor role=editor, canEdit=true", async () => {
    const coTutor = "88888888-8888-4888-8888-888888888888";
    signIn(coTutor, "tutor");
    vi.mocked(requireCourseAccess).mockResolvedValue(true);
    queueSessionFind();
    fakeDb.queue([], []);

    const { res, payload } = await requestToken();

    expect(res.status).toBe(200);
    expect(payload).toMatchObject({ role: "editor", canEdit: true });
    expect(requireCourseAccess).toHaveBeenCalledWith(coTutor, IDS.course, "tutor", "viewer");
  });

  it("gives the session host role=host, canEdit=true", async () => {
    signIn(IDS.tutor, "tutor");
    queueSessionFind({ hostId: IDS.tutor });
    fakeDb.queue([{ id: "participant-1", canEdit: true }], []);

    const { payload } = await requestToken();
    expect(payload).toMatchObject({ role: "host", canEdit: true });
  });

  it("gives the board owner (when someone else hosts) role=editor, canEdit=true", async () => {
    signIn(IDS.student, "student");
    queueSessionFind({ hostId: IDS.tutor, whiteboardOwnerId: IDS.student });
    fakeDb.queue([], []);

    const { payload } = await requestToken();
    expect(payload).toMatchObject({ role: "editor", canEdit: true });
  });

  it("refuses a user who isn't enrolled (404, not 403)", async () => {
    signIn(IDS.student2, "student");
    queueSessionFind();
    fakeDb.queue([]);   // no enrolment

    const { res, token } = await requestToken();
    expect(res.status).toBe(404);
    expect(token).toBeUndefined();
    expect(fakeDb.argsOf("values")).toHaveLength(0);
  });

  it("refuses tokens for an ended session", async () => {
    signIn(IDS.tutor, "tutor");
    queueSessionFind({ hostId: IDS.tutor, status: "ended" });

    const { res } = await requestToken();
    expect(res.status).toBe(409);
  });
});
