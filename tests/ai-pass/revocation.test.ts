import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/services/email.service", () => ({ EmailService: { aiPassOpsAlert: vi.fn() } }));
import { EmailService } from "@/services/email.service";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiTutorPasses } from "@/db/schema";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import { DAY_MS } from "@/lib/ai-pass/config";
import { enrol, fakeStripe, hasDb, json, makeCourse, makePass, makeUser, mockStudyMind, resetDb } from "../helpers";

const charge = (pi: string, refunded: number) => ({ id: "ch_1", payment_intent: pi, amount: 999, amount_refunded: refunded }) as Stripe.Charge;
const dispute = (pi: string, status = "needs_response") => ({ id: "dp_1", payment_intent: pi, status, amount: 999 }) as Stripe.Dispute;
const load = async (id: string) => (await db.select().from(aiTutorPasses).where(eq(aiTutorPasses.id, id)))[0];

describe.skipIf(!hasDb)("AI Tutor Pass refunds, disputes and StudyMind revocation", () => {
  let stripe: ReturnType<typeof fakeStripe>;
  beforeEach(async () => { await resetDb(); stripe = fakeStripe(); vi.mocked(EmailService.aiPassOpsAlert).mockClear(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); delete process.env.ADMIN_EMAIL; });

  it("full refund revokes immediately and revokes the StudyMind policy", async () => {
    const sm = mockStudyMind(() => json(200, { status: "revoked" }));
    const s = await makeUser(); const p = await makePass(s.id, { policy: true });
    expect(await AiTutorPassService.handleRefund(charge(p.stripePaymentIntentId!, 999))).toBe(true);
    const row = await load(p.id);
    expect(row.revokedAt).not.toBeNull();
    expect(row.paymentStatus).toBe("refunded");
    expect(row.studymindRevokeStatus).toBe("done");
    expect(sm.calls[0].url).toBe("https://studymind.test/api/v1/usage/policy/revoke");
    expect(sm.calls[0].body).toMatchObject({ pass_id: p.id, user_id: s.id });
    expect(await AiTutorPassService.currentPass(s.id)).toBeNull();
  });

  it("partial refund is recorded and access is kept", async () => {
    const sm = mockStudyMind(() => json(200, {}));
    const s = await makeUser(); const p = await makePass(s.id);
    await AiTutorPassService.handleRefund(charge(p.stripePaymentIntentId!, 300));
    const row = await load(p.id);
    expect(row.revokedAt).toBeNull();
    expect(row.paymentStatus).toBe("partially_refunded");
    expect(row.refundedAmountPence).toBe(300);
    expect(sm.calls).toHaveLength(0);
    expect((await AiTutorPassService.currentPass(s.id))?.id).toBe(p.id);
  });

  it("partial then full refund revokes", async () => {
    mockStudyMind(() => json(200, {}));
    const s = await makeUser(); const p = await makePass(s.id);
    await AiTutorPassService.handleRefund(charge(p.stripePaymentIntentId!, 300));
    await AiTutorPassService.handleRefund(charge(p.stripePaymentIntentId!, 999));
    expect((await load(p.id)).revokedAt).not.toBeNull();
  });

  it("a later partial-refund event never restores a revoked pass", async () => {
    mockStudyMind(() => json(200, {}));
    const s = await makeUser(); const p = await makePass(s.id);
    await AiTutorPassService.handleDisputeCreated(dispute(p.stripePaymentIntentId!));
    await AiTutorPassService.handleRefund(charge(p.stripePaymentIntentId!, 100));
    const row = await load(p.id);
    expect(row.revokedAt).not.toBeNull();
    expect(row.paymentStatus).toBe("disputed");
  });

  it("refunds for course purchases are not handled (and never call Stripe)", async () => {
    const s = await makeUser(); const c = await makeCourse("20.00");
    await enrol(s.id, c.id, { amount: "20.00" });
    const { db: d } = await import("@/db"); const { purchases } = await import("@/db/schema");
    await d.update(purchases).set({ stripePaymentIntentId: "pi_course_purchase" });
    expect(await AiTutorPassService.handleRefund(charge("pi_course_purchase", 999))).toBe(false);
    expect(stripe.spies.piRetrieve).not.toHaveBeenCalled();
  });

  it("refunds for other (non-pass) payments are not handled", async () => {
    stripe.intents.set("pi_other", { id: "pi_other", metadata: {}, latest_charge: {} } as never);
    expect(await AiTutorPassService.handleRefund(charge("pi_other", 999))).toBe(false);
  });

  it("dispute revokes; a won dispute stays revoked", async () => {
    mockStudyMind(() => json(200, {}));
    const s = await makeUser(); const p = await makePass(s.id);
    await AiTutorPassService.handleDisputeCreated(dispute(p.stripePaymentIntentId!));
    await AiTutorPassService.handleDisputeClosed(dispute(p.stripePaymentIntentId!, "won"));
    const row = await load(p.id);
    expect(row.revokedAt).not.toBeNull();
    expect(row.revokeReason).toBe("disputed");
    expect(row.disputeStatus).toBe("won");
    expect(await AiTutorPassService.currentPass(s.id)).toBeNull();
  });

  it("StudyMind unreachable: Learnify stays revoked, revocation is queued and retried", async () => {
    mockStudyMind(() => { throw new TypeError("fetch failed"); });
    const s = await makeUser(); const p = await makePass(s.id, { policy: true });
    await AiTutorPassService.handleRefund(charge(p.stripePaymentIntentId!, 999));

    let row = await load(p.id);
    expect(row.revokedAt).not.toBeNull();
    expect(row.studymindRevokeStatus).toBe("pending");
    expect(row.studymindRevokeAttempts).toBe(1);
    expect(row.studymindRevokeLastError).toContain("fetch failed");
    expect(row.studymindRevokeNextAttemptAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await AiTutorPassService.currentPass(s.id)).toBeNull();

    // Not due yet → the cron skips it
    vi.unstubAllGlobals();
    const sm = mockStudyMind(() => json(200, {}));
    expect((await AiTutorPassService.processPendingRevocations()).due).toBe(0);

    // Due → retried and completed
    await db.update(aiTutorPasses).set({ studymindRevokeNextAttemptAt: new Date(Date.now() - 1000) }).where(eq(aiTutorPasses.id, p.id));
    expect(await AiTutorPassService.processPendingRevocations()).toEqual({ due: 1, done: 1, failed: 0 });
    row = await load(p.id);
    expect(row.studymindRevokeStatus).toBe("done");
    expect(row.revokedAt).not.toBeNull();
    expect(sm.calls).toHaveLength(1);

    // Idempotent: nothing left to do
    expect((await AiTutorPassService.processPendingRevocations()).due).toBe(0);
  });

  it("StudyMind 5xx backs off exponentially without touching the Learnify revocation", async () => {
    mockStudyMind(() => json(503, { detail: "down" }));
    const s = await makeUser(); const p = await makePass(s.id, { policy: true });
    await AiTutorPassService.revoke(p.id, "refunded");
    const first = await load(p.id);
    await db.update(aiTutorPasses).set({ studymindRevokeNextAttemptAt: new Date(0) }).where(eq(aiTutorPasses.id, p.id));
    await AiTutorPassService.processPendingRevocations();
    const second = await load(p.id);
    expect(second.studymindRevokeAttempts).toBe(2);
    expect(second.studymindRevokeNextAttemptAt!.getTime() - Date.now()).toBeGreaterThan(first.studymindRevokeNextAttemptAt!.getTime() - first.updatedAt.getTime());
    expect(second.revokedAt!.getTime()).toBe(first.revokedAt!.getTime());
  });

  it("no StudyMind policy yet (pass never used) counts as revoked", async () => {
    mockStudyMind(() => json(404, { detail: "Policy not found", code: "policy_not_found" }));
    const s = await makeUser(); const p = await makePass(s.id);
    await AiTutorPassService.revoke(p.id, "refunded");
    expect((await load(p.id)).studymindRevokeStatus).toBe("done");
  });

  it("an unexpected 404 (wrong URL etc.) is retried, not treated as done", async () => {
    mockStudyMind(() => json(404, { detail: "Not Found" }));
    const s = await makeUser(); const p = await makePass(s.id);
    await AiTutorPassService.revoke(p.id, "refunded");
    expect((await load(p.id)).studymindRevokeStatus).toBe("pending");
  });

  it("concurrent workers claim each job once (SKIP LOCKED + lease)", async () => {
    let n = 0;
    mockStudyMind(async () => { n++; await new Promise((r) => setTimeout(r, 150)); return json(200, {}); });
    const s = await makeUser();
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const p = await makePass(s.id, { policy: true });
      await db.update(aiTutorPasses).set({ revokedAt: new Date(), studymindRevokeStatus: "pending", studymindRevokeNextAttemptAt: new Date(0) }).where(eq(aiTutorPasses.id, p.id));
      ids.push(p.id);
    }
    const results = await Promise.all([1, 2, 3].map(() => AiTutorPassService.processPendingRevocations()));
    expect(results.reduce((a, r) => a + r.due, 0)).toBe(4);
    expect(n).toBe(4);
    for (const id of ids) expect((await load(id)).studymindRevokeStatus).toBe("done");
  });

  it("concurrent failures count every attempt and never mark done", async () => {
    mockStudyMind(() => json(503, {}));
    const s = await makeUser(); const p = await makePass(s.id, { policy: true });
    await db.update(aiTutorPasses).set({ revokedAt: new Date(), studymindRevokeStatus: "pending", studymindRevokeNextAttemptAt: new Date(0) }).where(eq(aiTutorPasses.id, p.id));
    await Promise.all([AiTutorPassService.processPendingRevocations(), AiTutorPassService.processPendingRevocations()]);
    const row = await load(p.id);
    expect(row.studymindRevokeStatus).toBe("pending");
    expect(row.studymindRevokeAttempts).toBe(1);   // claimed by one worker only
  });

  it("persistent failure alerts administrators once, at the 5th attempt, and keeps retrying", async () => {
    process.env.ADMIN_EMAIL = "admin@test.local";
    mockStudyMind(() => json(500, {}));
    const s = await makeUser(); const p = await makePass(s.id, { policy: true });
    await AiTutorPassService.revoke(p.id, "refunded");
    for (let i = 0; i < 6; i++) {
      await db.update(aiTutorPasses).set({ studymindRevokeNextAttemptAt: new Date(0) }).where(eq(aiTutorPasses.id, p.id));
      await AiTutorPassService.processPendingRevocations();
    }
    const row = await load(p.id);
    expect(row.studymindRevokeAttempts).toBe(7);
    expect(row.studymindRevokeStatus).toBe("pending");
    expect(row.revokedAt).not.toBeNull();
    expect(row.studymindRevokeNextAttemptAt!.getTime() - Date.now()).toBeLessThanOrEqual(6 * 3600e3);
    expect(EmailService.aiPassOpsAlert).toHaveBeenCalledOnce();
    const issues = await AiTutorPassService.adminIssues();
    expect(issues.failingRevocations.map((r) => r.passId)).toEqual([p.id]);
  });

  it("a revoke on an already-done pass does not re-queue StudyMind", async () => {
    const sm = mockStudyMind(() => json(200, {}));
    const s = await makeUser(); const p = await makePass(s.id, { policy: true });
    await AiTutorPassService.revoke(p.id, "refunded");
    await AiTutorPassService.revoke(p.id, "disputed");
    const row = await load(p.id);
    expect(row.revokeReason).toBe("refunded");
    expect(sm.calls).toHaveLength(1);
  });

  it("revoking the current pass moves queued (unused) passes forward", async () => {
    mockStudyMind(() => json(200, {}));
    const s = await makeUser();
    const current = await makePass(s.id, { endOffsetMs: 10 * DAY_MS, policy: true });
    const queued  = await makePass(s.id, { startOffsetMs: 10 * DAY_MS, endOffsetMs: 40 * DAY_MS });
    await AiTutorPassService.revoke(current.id, "refunded");
    const q = await load(queued.id);
    expect(q.startsAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(q.endsAt.getTime() - q.startsAt.getTime()).toBe(30 * DAY_MS);
    expect((await AiTutorPassService.currentPass(s.id))?.id).toBe(queued.id);
  });

  it("revoking a queued pass closes the gap for the one after it", async () => {
    mockStudyMind(() => json(200, {}));
    const s = await makeUser();
    const current = await makePass(s.id, { endOffsetMs: 10 * DAY_MS, policy: true });
    const q1 = await makePass(s.id, { startOffsetMs: 10 * DAY_MS, endOffsetMs: 40 * DAY_MS });
    const q2 = await makePass(s.id, { startOffsetMs: 40 * DAY_MS, endOffsetMs: 70 * DAY_MS });
    await AiTutorPassService.revoke(q1.id, "refunded");
    expect((await load(q2.id)).startsAt.getTime()).toBe(current.endsAt.getTime());
    expect((await load(current.id)).endsAt.getTime()).toBe(current.endsAt.getTime());
  });
});
