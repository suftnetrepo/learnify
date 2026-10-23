import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { POST } from "@/app/api/studymind/session/route";
import { db } from "@/db";
import { aiTutorPasses } from "@/db/schema";
import { enrol, hasDb, json, jsonRequest, makeCourse, makePass, makeUser, mockStudyMind, resetDb } from "../helpers";

const signIn = (u: { id: string; role: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: u.id, role: u.role, email: "x@test.local" } } as never);
const call = (courseId: string) => POST(jsonRequest("https://learnify.test/api/studymind/session", { courseId }));
const tokenOk = () => json(200, { session_token: "tok", expires_at: new Date(Date.now() + 3600e3).toISOString(), expires_in: 3600 });

describe.skipIf(!hasDb)("POST /api/studymind/session", () => {
  beforeEach(async () => { await resetDb(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete process.env.ENABLE_AI_TUTOR_PASS; });

  describe("flag off — behaves exactly as before", () => {
    it("free course: paid-only 403, StudyMind never called (even with a pass)", async () => {
      const sm = mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("0");
      await enrol(s.id, c.id); await makePass(s.id); signIn(s);
      const res = await call(c.id);
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe("The AI tutor is available on paid courses only");
      expect(sm.calls).toHaveLength(0);
    });

    it("paid course: unrestricted token, no usage_policy, 1-hour TTL", async () => {
      const sm = mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("20.00");
      await enrol(s.id, c.id, { amount: "20.00" }); signIn(s);
      const res = await call(c.id);
      expect(res.status).toBe(200);
      expect(sm.calls[0].body).toEqual({ course_id: c.id, user_id: s.id, user_role: "student", expires_in: 3600 });
    });

    it("grandfathered (now-free) course is NOT unlocked while the flag is off", async () => {
      mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("0");
      await enrol(s.id, c.id, { amount: "20.00" }); signIn(s);
      expect((await call(c.id)).status).toBe(403);
    });
  });

  describe("flag on", () => {
    beforeEach(() => { process.env.ENABLE_AI_TUTOR_PASS = "true"; });

    it("paid course: identical unrestricted request", async () => {
      const sm = mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("20.00");
      await enrol(s.id, c.id, { amount: "20.00" }); await makePass(s.id); signIn(s);
      expect((await call(c.id)).status).toBe(200);
      expect(sm.calls[0].body).toEqual({ course_id: c.id, user_id: s.id, user_role: "student", expires_in: 3600 });
    });

    it("grandfathered purchaser of a now-free course: unrestricted token", async () => {
      const sm = mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("0");
      await enrol(s.id, c.id, { amount: "20.00" }); signIn(s);
      expect((await call(c.id)).status).toBe(200);
      expect(sm.calls[0].body).not.toHaveProperty("usage_policy");
    });

    it("free course with a pass: usage-limited token and policy bookkeeping", async () => {
      const sm = mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("0");
      await enrol(s.id, c.id); const p = await makePass(s.id); signIn(s);
      expect((await call(c.id)).status).toBe(200);
      expect(sm.calls[0].body).toMatchObject({
        user_role: "student", expires_in: 3600,
        usage_policy: { type: "learnify_free_course_pass", pass_id: p.id, expires_at: p.endsAt.toISOString() },
      });
      const [row] = await db.select().from(aiTutorPasses).where(eq(aiTutorPasses.id, p.id));
      expect(row.studymindPolicyCreatedAt).not.toBeNull();
    });

    it("pass with under 5 minutes left: asks for StudyMind's 300 s minimum (StudyMind caps at pass end)", async () => {
      const sm = mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("0");
      await enrol(s.id, c.id); await makePass(s.id, { endOffsetMs: 120_000 }); signIn(s);
      expect((await call(c.id)).status).toBe(200);
      expect(sm.calls[0].body?.expires_in).toBe(300);
    });

    it("pass with 20 minutes left: token lifetime matches the remaining time", async () => {
      const sm = mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("0");
      await enrol(s.id, c.id); await makePass(s.id, { endOffsetMs: 20 * 60_000 }); signIn(s);
      await call(c.id);
      expect(sm.calls[0].body?.expires_in).toBeGreaterThan(1190);
      expect(sm.calls[0].body?.expires_in).toBeLessThanOrEqual(1200);
    });

    it("free course without a pass: 402, no token", async () => {
      const sm = mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("0");
      await enrol(s.id, c.id, { amount: "0" }); signIn(s);
      const res = await call(c.id);
      expect(res.status).toBe(402);
      expect((await res.json()).code).toBe("ai_pass_required");
      expect(sm.calls).toHaveLength(0);
    });

    it("pass ending within 5 s: treated as ended", async () => {
      const sm = mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("0");
      await enrol(s.id, c.id); await makePass(s.id, { endOffsetMs: 3000 }); signIn(s);
      expect((await call(c.id)).status).toBe(402);
      expect(sm.calls).toHaveLength(0);
    });

    it("not enrolled: 403", async () => {
      mockStudyMind(tokenOk);
      const s = await makeUser(); const c = await makeCourse("0"); await makePass(s.id); signIn(s);
      expect((await call(c.id)).status).toBe(403);
    });

    for (const [status, code] of [[409, "policy_conflict"], [403, "policy_revoked"], [403, "policy_expired"]] as const) {
      it(`StudyMind refuses the pass policy (${status} ${code}): 403, no unrestricted fallback`, async () => {
        const sm = mockStudyMind(() => json(status, { detail: "refused", code }));
        const s = await makeUser(); const c = await makeCourse("0");
        await enrol(s.id, c.id); await makePass(s.id); signIn(s);
        const res = await call(c.id);
        expect(res.status).toBe(403);
        expect((await res.json()).code).toBe(code);
        expect(sm.calls).toHaveLength(1);
        expect(sm.calls[0].body).toHaveProperty("usage_policy");
      });
    }

    it("StudyMind unreachable: error, no token, single attempt with the policy", async () => {
      const sm = mockStudyMind(() => { throw new TypeError("fetch failed"); });
      const s = await makeUser(); const c = await makeCourse("0");
      await enrol(s.id, c.id); await makePass(s.id); signIn(s);
      const res = await call(c.id);
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(await res.json()).not.toHaveProperty("sessionToken");
      expect(sm.calls).toHaveLength(1);
    });

    it("StudyMind 5xx on a pass session: 502, no token", async () => {
      mockStudyMind(() => json(500, { detail: "boom" }));
      const s = await makeUser(); const c = await makeCourse("0");
      await enrol(s.id, c.id); await makePass(s.id); signIn(s);
      expect((await call(c.id)).status).toBe(502);
    });

    it("tutors and admins keep the existing path (no usage_policy) on free courses", async () => {
      const sm = mockStudyMind(tokenOk);
      const a = await makeUser("admin"); const c = await makeCourse("0"); signIn(a);
      expect((await call(c.id)).status).toBe(200);
      expect(sm.calls[0].body).toEqual({ course_id: c.id, user_id: a.id, user_role: "admin", expires_in: 3600 });
    });
  });
});
