import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", async () => ({ db: (await import("./helpers")).fakeDb.db }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/access/course", () => ({ requireCourseAccess: vi.fn(async () => false) }));

import { auth } from "@/lib/auth";
import { requireCourseAccess } from "@/lib/access/course";
import { POST as startSession } from "@/app/api/whiteboards/sessions/route";
import { GET as getSession } from "@/app/api/whiteboards/sessions/[sessionId]/route";
import { PATCH as patchParticipants } from "@/app/api/whiteboards/sessions/[sessionId]/participants/route";
import { fakeDb, jsonRequest, params, readJson, IDS, sessionUser, findByIdResult, queueSessionFind } from "./helpers";

const signIn = (id: string, role: "student" | "tutor" | "admin") =>
  vi.mocked(auth).mockResolvedValue(sessionUser(id, role) as never);

beforeEach(() => {
  fakeDb.reset();
  vi.mocked(auth).mockReset();
  vi.mocked(requireCourseAccess).mockReset().mockResolvedValue(false);
});

describe("POST /api/whiteboards/sessions", () => {
  it("refuses a student who doesn't own the board (404: students can't see others' boards)", async () => {
    signIn(IDS.student, "student");
    fakeDb.queue(
      findByIdResult({ ownerId: IDS.tutor, courseId: IDS.course }),   // the board
      [],                                                             // no active session
    );

    const res = await startSession(jsonRequest("/api/whiteboards/sessions", "POST", { whiteboardId: IDS.board }));

    expect(res.status).toBe(404);
    expect(fakeDb.argsOf("insert")).toHaveLength(0);
  });

  it("refuses a tutor not assigned to the board's course (403: tutors can read every board)", async () => {
    signIn(IDS.tutor, "tutor");
    fakeDb.queue(findByIdResult({ ownerId: IDS.student, courseId: IDS.course }), []);

    const res = await startSession(jsonRequest("/api/whiteboards/sessions", "POST", { whiteboardId: IDS.board }));

    expect(res.status).toBe(403);
    expect(fakeDb.argsOf("insert")).toHaveLength(0);
  });

  it("returns the existing active session instead of creating another", async () => {
    signIn(IDS.student, "student");
    fakeDb.queue(
      findByIdResult({ ownerId: IDS.tutor, courseId: IDS.course }),
      [{ id: IDS.session }],   // findActiveForWhiteboard → active session id
    );
    queueSessionFind();         // …then its details
    fakeDb.queue([{ id: "enrollment-1" }]);   // student is enrolled → may join

    const res  = await startSession(jsonRequest("/api/whiteboards/sessions", "POST", { whiteboardId: IDS.board }));
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ sessionId: IDS.session, resumed: true });
    expect(fakeDb.argsOf("insert")).toHaveLength(0);
  });

  it("creates a session with the creator as host when none is active", async () => {
    signIn(IDS.tutor, "tutor");
    vi.mocked(requireCourseAccess).mockResolvedValue(true);
    fakeDb.queue(
      findByIdResult({ ownerId: IDS.student, courseId: IDS.course }),
      [],                     // no active session
      [],                     // advisory lock
      [],                     // re-check inside the transaction
      [{ id: IDS.session }],  // INSERT session
      [],                     // INSERT host participant
    );

    const res  = await startSession(jsonRequest("/api/whiteboards/sessions", "POST", { whiteboardId: IDS.board }));
    const body = await readJson(res);

    expect(res.status).toBe(201);
    expect(body.data).toEqual({ sessionId: IDS.session, resumed: false });
    const inserted = fakeDb.argsOf("values").map((a) => a[0]);
    expect(inserted[0]).toMatchObject({ whiteboardId: IDS.board, hostId: IDS.tutor, status: "active" });
    expect(inserted[1]).toMatchObject({ userId: IDS.tutor, role: "host", canEdit: true });
  });
});

describe("GET /api/whiteboards/sessions/[sessionId]", () => {
  it("refuses a user who isn't enrolled in the course (404, not 403)", async () => {
    signIn(IDS.student2, "student");
    queueSessionFind();
    fakeDb.queue([]);   // no enrolment

    const res = await getSession(jsonRequest(`/api/whiteboards/sessions/${IDS.session}`, "GET"), params({ sessionId: IDS.session }));
    expect(res.status).toBe(404);
  });

  it("returns the session and participants to an enrolled student", async () => {
    signIn(IDS.student, "student");
    queueSessionFind();
    fakeDb.queue([{ id: "enrollment-1" }], [{ userId: IDS.tutor, name: "Tess", role: "host", canEdit: true }]);

    const res  = await getSession(jsonRequest(`/api/whiteboards/sessions/${IDS.session}`, "GET"), params({ sessionId: IDS.session }));
    const body = await readJson(res);

    expect(res.status).toBe(200);
    expect(body.data).toMatchObject({
      session:      { id: IDS.session, courseTitle: "Algebra 101" },
      participants: [{ userId: IDS.tutor, role: "host" }],
      you:          { role: "viewer", canEdit: false },
    });
  });
});

describe("PATCH /api/whiteboards/sessions/[sessionId]/participants", () => {
  const url = `/api/whiteboards/sessions/${IDS.session}/participants`;

  it("returns 403 for a participant who isn't the host", async () => {
    // An assigned co-tutor can join (editor) but isn't the host
    const coTutor = "88888888-8888-4888-8888-888888888888";
    signIn(coTutor, "tutor");
    vi.mocked(requireCourseAccess).mockResolvedValue(true);
    queueSessionFind();

    const res = await patchParticipants(jsonRequest(url, "PATCH", { userId: IDS.student, canEdit: true }), params({ sessionId: IDS.session }));

    expect(res.status).toBe(403);
    expect(fakeDb.argsOf("set")).toHaveLength(0);
  });

  it("lets the host grant drawing access", async () => {
    signIn(IDS.tutor, "tutor");
    queueSessionFind();
    fakeDb.queue([{ id: "participant-1" }]);   // UPDATE ... RETURNING

    const res = await patchParticipants(jsonRequest(url, "PATCH", { userId: IDS.student, canEdit: true }), params({ sessionId: IDS.session }));

    expect(res.status).toBe(200);
    expect(fakeDb.argsOf("set")[0][0]).toEqual({ canEdit: true });
  });
});
