import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveStudentAiAccess } from "@/lib/ai-pass/access";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import { enrol, hasDb, makeCourse, makePass, makeUser, resetDb } from "../helpers";

describe.skipIf(!hasDb)("resolveStudentAiAccess", () => {
  beforeEach(async () => { await resetDb(); process.env.ENABLE_AI_TUTOR_PASS = "true"; });
  afterEach(() => { delete process.env.ENABLE_AI_TUTOR_PASS; });

  it("flag off: free course is unavailable even with a pass (today's behaviour)", async () => {
    delete process.env.ENABLE_AI_TUTOR_PASS;
    const s = await makeUser(); const c = await makeCourse("0");
    await enrol(s.id, c.id, { amount: "0" });
    await makePass(s.id);
    expect(await resolveStudentAiAccess(s.id, c.id)).toEqual({ kind: "unavailable" });
  });

  it("paid course: unrestricted, unaffected by passes", async () => {
    const s = await makeUser(); const c = await makeCourse("49.00");
    await enrol(s.id, c.id, { amount: "49.00" });
    expect(await resolveStudentAiAccess(s.id, c.id)).toEqual({ kind: "paid", grandfathered: false });
  });

  it("paid course with flag off is still paid", async () => {
    delete process.env.ENABLE_AI_TUTOR_PASS;
    const s = await makeUser(); const c = await makeCourse("49.00");
    await enrol(s.id, c.id, { amount: "49.00" });
    expect((await resolveStudentAiAccess(s.id, c.id)).kind).toBe("paid");
  });

  it("paid-to-free conversion: genuine purchasers are grandfathered", async () => {
    const s = await makeUser(); const c = await makeCourse("0");   // was paid, now free
    await enrol(s.id, c.id, { amount: "29.99" });
    expect(await resolveStudentAiAccess(s.id, c.id)).toEqual({ kind: "paid", grandfathered: true });
  });

  it("zero-value purchase never grandfathers", async () => {
    const s = await makeUser(); const c = await makeCourse("0");
    await enrol(s.id, c.id, { amount: "0" });
    expect((await resolveStudentAiAccess(s.id, c.id)).kind).toBe("pass_required");
  });

  it("refunded or pending paid purchase never grandfathers", async () => {
    const s = await makeUser(); const c = await makeCourse("0");
    await enrol(s.id, c.id, { amount: "29.99", status: "refunded" });
    expect((await resolveStudentAiAccess(s.id, c.id)).kind).toBe("pass_required");
  });

  it("not enrolled", async () => {
    const s = await makeUser(); const c = await makeCourse("0");
    await makePass(s.id);
    expect((await resolveStudentAiAccess(s.id, c.id)).kind).toBe("not_enrolled");
  });

  it("free course with a current pass", async () => {
    const s = await makeUser(); const c = await makeCourse("0");
    await enrol(s.id, c.id);
    const p = await makePass(s.id);
    const a = await resolveStudentAiAccess(s.id, c.id);
    expect(a.kind).toBe("pass");
    expect(a.kind === "pass" && a.pass.id).toBe(p.id);
  });

  it("revoked, expired, queued and nearly-ended passes do not grant access", async () => {
    const s = await makeUser(); const c = await makeCourse("0");
    await enrol(s.id, c.id);
    await makePass(s.id, { revoked: true });
    await makePass(s.id, { startOffsetMs: -40 * 86400e3, endOffsetMs: -10 * 86400e3 });
    await makePass(s.id, { startOffsetMs: 86400e3, endOffsetMs: 31 * 86400e3 });
    await makePass(s.id, { endOffsetMs: 4_000 });   // <= 5 s left counts as ended
    expect((await resolveStudentAiAccess(s.id, c.id)).kind).toBe("pass_required");
  });

  it("a pass with under 5 minutes (but > 5 s) left still grants access", async () => {
    const s = await makeUser(); const c = await makeCourse("0");
    await enrol(s.id, c.id);
    await makePass(s.id, { endOffsetMs: 120_000 });
    expect((await resolveStudentAiAccess(s.id, c.id)).kind).toBe("pass");
  });

  it("purchase eligibility: enrolled free course only, not grandfathered or paid", async () => {
    const s = await makeUser();
    const free = await makeCourse("0"), paid = await makeCourse("10.00"), grand = await makeCourse("0"), other = await makeCourse("0");
    await enrol(s.id, free.id, { amount: "0" });
    await enrol(s.id, paid.id, { amount: "10.00" });
    await enrol(s.id, grand.id, { amount: "15.00" });
    expect(await AiTutorPassService.isEnrolledInFreeCourse(s.id, free.id)).toBe(true);
    expect(await AiTutorPassService.isEnrolledInFreeCourse(s.id, paid.id)).toBe(false);
    expect(await AiTutorPassService.isEnrolledInFreeCourse(s.id, grand.id)).toBe(false);
    expect(await AiTutorPassService.isEnrolledInFreeCourse(s.id, other.id)).toBe(false);
  });
});
