import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { POST as checkout } from "@/app/api/ai-pass/checkout/route";
import { POST as confirm } from "@/app/api/ai-pass/confirm/route";
import { GET as status } from "@/app/api/ai-pass/status/route";
import { GET as cron } from "@/app/api/cron/ai-pass-revocations/route";
import { GET as adminIssues } from "@/app/api/ai-pass/admin/issues/route";
import { db } from "@/db";
import { aiPassCheckouts, aiTutorPasses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DAY_MS } from "@/lib/ai-pass/config";
import { AI_PASS_TERMS } from "@/lib/ai-pass/terms";
import { enrol, fakeStripe, hasDb, json, jsonRequest, makeCourse, makePass, makeUser, mockStudyMind, resetDb } from "../helpers";

const signIn = (u: { id: string; role: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: u.id, role: u.role, email: "s@test.local" } } as never);
const buy = (body: unknown) => checkout(jsonRequest("https://learnify.test/api/ai-pass/checkout", body));
/** A valid purchase request: terms accepted for the current version, immediate access as given. */
const agree = (courseId: string, immediateAccess = false) => ({ courseId, acceptTerms: true, termsVersion: AI_PASS_TERMS.version, immediateAccess });

describe.skipIf(!hasDb)("AI Tutor Pass purchase routes", () => {
  let create: MockInstance<typeof stripe.checkout.sessions.create>;
  let fake: ReturnType<typeof fakeStripe>;
  beforeEach(async () => {
    await resetDb();
    process.env.ENABLE_AI_TUTOR_PASS = "true";
    fake = fakeStripe();
    create = fake.spies.create as never;
    (globalThis as { __rateLimitStore?: Map<string, unknown> }).__rateLimitStore?.clear();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete process.env.ENABLE_AI_TUTOR_PASS; process.env.STRIPE_AI_PASS_PRICE_ID = "price_ai_pass_test"; });

  describe("POST /api/ai-pass/checkout", () => {
    it("404 when the flag is off", async () => {
      delete process.env.ENABLE_AI_TUTOR_PASS;
      expect((await buy({})).status).toBe(404);
      expect(create).not.toHaveBeenCalled();
    });

    it("creates a one-time Checkout with the dedicated price, no promo codes, managed payments off", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      const res = await buy(agree(c.id));
      expect(res.status).toBe(200);
      expect((await res.json()).data.url).toMatch(/^https:\/\/checkout\.stripe\.test\/cs_test_/);
      const [reservation] = await db.select().from(aiPassCheckouts);
      expect(reservation).toMatchObject({ studentId: s.id, status: "open" });
      const params = create.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
      expect(params).toMatchObject({
        mode: "payment", line_items: [{ price: "price_ai_pass_test", quantity: 1 }], payment_method_types: ["card"],
        allow_promotion_codes: false, managed_payments: { enabled: false }, client_reference_id: s.id,
        metadata: { app: "learnify", kind: "ai_tutor_pass", student_id: s.id, return_course_id: c.id },
        payment_intent_data: { metadata: { app: "learnify", kind: "ai_tutor_pass", student_id: s.id } },
      });
      expect(params.metadata).toMatchObject({ terms_version: AI_PASS_TERMS.version, immediate_access: "false" });
      expect(params.metadata?.consent_at).toBeTruthy();
      expect(params).not.toHaveProperty("discounts");
      expect(params.payment_intent_data).not.toHaveProperty("application_fee_amount");
      expect(params.payment_intent_data).not.toHaveProperty("transfer_data");
    });

    it("requires explicit acceptance of the terms — nothing is assumed", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      const v = AI_PASS_TERMS.version;
      for (const body of [
        { courseId: c.id },                                                                  // nothing
        { courseId: c.id, consent: true },                                                   // old shape
        { courseId: c.id, acceptTerms: false, termsVersion: v, immediateAccess: false },     // not accepted
        { courseId: c.id, acceptTerms: "yes", termsVersion: v, immediateAccess: false },     // not a real tick
        { courseId: c.id, acceptTerms: true, immediateAccess: false },                       // no version
        { courseId: c.id, acceptTerms: true, termsVersion: v },                              // immediate-access choice not explicit
      ]) {
        (globalThis as { __rateLimitStore?: Map<string, unknown> }).__rateLimitStore?.clear();   // isolate from the checkout rate limit
        expect((await buy(body)).status).toBe(400);
      }
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects acceptance of an outdated terms version", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      const res = await buy({ ...agree(c.id), termsVersion: "2020-01-01" });
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("TERMS_OUTDATED");
      expect(create).not.toHaveBeenCalled();
    });

    it("records the consent server-side: terms version, timestamp, student, session and the immediate-access choice", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      const before = Date.now();
      await buy(agree(c.id, true));
      const [row] = await db.select().from(aiPassCheckouts);
      expect(row).toMatchObject({ studentId: s.id, termsVersion: AI_PASS_TERMS.version, immediateAccessAck: true });
      expect(row.stripeCheckoutSessionId).toMatch(/^cs_test_/);
      expect(row.consentAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
      const params = create.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
      expect(params.metadata).toMatchObject({ terms_version: AI_PASS_TERMS.version, immediate_access: "true" });
    });

    it("not ticking immediate access keeps cancellation rights (recorded as false)", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      expect((await buy(agree(c.id, false))).status).toBe(200);
      const [row] = await db.select().from(aiPassCheckouts);
      expect(row.immediateAccessAck).toBe(false);
    });

    it("a queued purchase never records an immediate-access request", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      await makePass(s.id, { endOffsetMs: 10 * DAY_MS });
      await buy(agree(c.id, true));
      const [row] = await db.select().from(aiPassCheckouts);
      expect(row.immediateAccessAck).toBe(false);
      expect((create.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams).metadata).toMatchObject({ immediate_access: "false" });
    });

    it("requires enrolment in a free course", async () => {
      const s = await makeUser(); signIn(s);
      const free = await makeCourse("0"), paid = await makeCourse("10.00"), grand = await makeCourse("0");
      await enrol(s.id, paid.id, { amount: "10.00" });
      await enrol(s.id, grand.id, { amount: "10.00" });
      for (const c of [free, paid, grand]) expect((await buy(agree(c.id))).status).toBe(403);
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects non-students and signed-out users", async () => {
      const c = await makeCourse("0");
      vi.mocked(auth).mockResolvedValue(null as never);
      expect((await buy(agree(c.id))).status).toBe(401);
      signIn(await makeUser("tutor"));
      expect((await buy(agree(c.id))).status).toBe(403);
    });

    it("allows at most one active + two queued passes", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      await makePass(s.id, { endOffsetMs: 10 * DAY_MS });
      await makePass(s.id, { startOffsetMs: 10 * DAY_MS, endOffsetMs: 40 * DAY_MS });
      expect((await buy(agree(c.id))).status).toBe(200);
      await makePass(s.id, { startOffsetMs: 40 * DAY_MS, endOffsetMs: 70 * DAY_MS });
      expect((await buy(agree(c.id))).status).toBe(409);
    });

    it("multiple tabs: a new checkout expires the previous unpaid one, so only one can be paid", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      await buy(agree(c.id));
      await buy(agree(c.id));
      const rows = await db.select().from(aiPassCheckouts).orderBy(aiPassCheckouts.createdAt);
      expect(rows.map((r) => r.status)).toEqual(["expired", "open"]);
      expect(fake.sessions.get(rows[0].stripeCheckoutSessionId)!.status).toBe("expired");
      expect(fake.spies.expire).toHaveBeenCalledWith(rows[0].stripeCheckoutSessionId);
    });

    it("a paid-but-unfulfilled checkout keeps its slot (it can't be expired)", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      await makePass(s.id, { endOffsetMs: 10 * DAY_MS });
      await makePass(s.id, { startOffsetMs: 10 * DAY_MS, endOffsetMs: 40 * DAY_MS });
      await buy(agree(c.id));
      const [first] = await db.select().from(aiPassCheckouts);
      fake.pay(s.id, { id: first.stripeCheckoutSessionId });   // paid; webhook not processed yet
      const res = await buy(agree(c.id));
      expect(res.status).toBe(409);
      expect((await db.select().from(aiPassCheckouts)).map((r) => r.status)).toEqual(["open"]);
    });

    it("concurrent checkout requests cannot reserve past the limit", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      await makePass(s.id, { endOffsetMs: 10 * DAY_MS });
      await makePass(s.id, { startOffsetMs: 10 * DAY_MS, endOffsetMs: 40 * DAY_MS });
      const codes = await Promise.all([1, 2, 3].map(() => buy(agree(c.id)).then((r) => r.status)));
      const open = (await db.select().from(aiPassCheckouts)).filter((r) => r.status === "open");
      expect(open.length).toBeLessThanOrEqual(1);
      expect(codes.filter((x) => x === 200).length).toBeGreaterThanOrEqual(1);
    });

    it("expired or abandoned checkouts free their slot", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      await makePass(s.id, { endOffsetMs: 10 * DAY_MS });
      await makePass(s.id, { startOffsetMs: 10 * DAY_MS, endOffsetMs: 40 * DAY_MS });
      await buy(agree(c.id));
      const [first] = await db.select().from(aiPassCheckouts);
      // Abandoned: past its expiry, even before Stripe's checkout.session.expired arrives
      await db.update(aiPassCheckouts).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(aiPassCheckouts.stripeCheckoutSessionId, first.stripeCheckoutSessionId));
      fake.sessions.get(first.stripeCheckoutSessionId)!.status = "expired";
      expect((await buy(agree(c.id))).status).toBe(200);
      // Expired by Stripe's webhook
      const { AiTutorPassService } = await import("@/services/ai-tutor-pass.service");
      const open = (await db.select().from(aiPassCheckouts)).find((r) => r.status === "open")!;
      await AiTutorPassService.handleStripeEvent({ id: "evt", type: "checkout.session.expired", data: { object: { id: open.stripeCheckoutSessionId, metadata: { app: "learnify", kind: "ai_tutor_pass" } } } } as never);
      expect((await db.select().from(aiPassCheckouts).where(eq(aiPassCheckouts.stripeCheckoutSessionId, open.stripeCheckoutSessionId)))[0].status).toBe("expired");
    });

    it("503 without a configured price (never falls back to a dynamic amount)", async () => {
      delete process.env.STRIPE_AI_PASS_PRICE_ID;
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      expect((await buy(agree(c.id))).status).toBe(503);
      expect(create).not.toHaveBeenCalled();
    });

    it("is rate limited", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      const codes = [];
      for (let i = 0; i < 6; i++) codes.push((await buy(agree(c.id))).status);
      expect(codes.at(-1)).toBe(429);
    });
  });

  describe("POST /api/ai-pass/confirm", () => {
    const post = (sessionId: string) => confirm(jsonRequest("https://learnify.test/api/ai-pass/confirm", { sessionId }));

    it("fulfils the caller's own paid session (idempotent with the webhook)", async () => {
      const s = await makeUser(); signIn(s);
      const session = fake.pay(s.id);
      const res = await post(session.id);
      expect(res.status).toBe(200);
      expect((await res.json()).data.current).not.toBeNull();
      await post(session.id);
      expect(await db.select().from(aiTutorPasses)).toHaveLength(1);
    });

    it("refuses someone else's session", async () => {
      const owner = await makeUser(), other = await makeUser(); signIn(other);
      const session = fake.pay(owner.id);
      expect((await post(session.id)).status).toBe(403);
      expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
    });

    it("unpaid session: 409, nothing granted", async () => {
      const s = await makeUser(); signIn(s);
      const session = fake.pay(s.id, { payment_status: "unpaid" });
      expect((await post(session.id)).status).toBe(409);
      expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
    });

    it("tampered amount: 409 not granted, recorded for review", async () => {
      const s = await makeUser(); signIn(s);
      const session = fake.pay(s.id, { amount_total: 100 });
      const res = await post(session.id);
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("PASS_NOT_GRANTED_INVALID");
      expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
    });

    it("paid after the limit was reached: 409 explaining the automatic refund", async () => {
      const s = await makeUser(); signIn(s);
      for (const [a, b] of [[-1, 10], [10, 40], [40, 70]]) await makePass(s.id, { startOffsetMs: a * DAY_MS, endOffsetMs: b * DAY_MS });
      const session = fake.pay(s.id);
      const res = await post(session.id);
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("PASS_NOT_GRANTED_QUEUE_FULL");
      expect(fake.refunds).toHaveLength(1);
      const body = (await (await status()).json()).data;
      expect(body.rejectedPayments[0]).toMatchObject({ reason: "queue_full", refundStatus: "refunded" });
    });

    it("404 when the flag is off", async () => {
      delete process.env.ENABLE_AI_TUTOR_PASS;
      expect((await post("cs_test_aaaaaaaaaa")).status).toBe(404);
    });
  });

  describe("GET /api/ai-pass/status", () => {
    it("flag off: disabled, no pass data", async () => {
      delete process.env.ENABLE_AI_TUTOR_PASS;
      const s = await makeUser(); await makePass(s.id); signIn(s);
      const body = (await (await status()).json()).data;
      expect(body.enabled).toBe(false);
      expect(body).not.toHaveProperty("current");
    });

    it("current, queued and live usage", async () => {
      mockStudyMind(() => json(200, { pass_id: "x", status: "active", features: {}, budget_exhausted: false }));
      const s = await makeUser(); signIn(s);
      const cur = await makePass(s.id, { endOffsetMs: 10 * DAY_MS, policy: true });
      await makePass(s.id, { startOffsetMs: 10 * DAY_MS, endOffsetMs: 40 * DAY_MS });
      const body = (await (await status()).json()).data;
      expect(body.current.passId).toBe(cur.id);
      expect(body.queued).toHaveLength(1);
      expect(body.canPurchaseMore).toBe(true);
      expect(body.usage.status).toBe("active");
    });

    it("shows the pass-level fair-use as a percentage and never sends the internal dollar budget to the browser", async () => {
      mockStudyMind(() => json(200, {
        pass_id: "x", status: "active", features: {}, budget_exhausted: false,
        budget: { total_usd: 4.5, spent_usd: 1.0, reserved_usd: 0.05, remaining_usd: 3.45 },
      }));
      const s = await makeUser(); signIn(s); await makePass(s.id, { policy: true });
      const raw = await (await status()).text();
      expect(raw).not.toContain("total_usd");
      expect(raw).not.toContain("4.5");
      const body = JSON.parse(raw).data;
      expect(body.usage).not.toHaveProperty("budget");
      expect(body.fairUse).toEqual({ remainingPercent: 75, level: "ok" });
    });

    it("StudyMind down: status still works, usage marked unavailable", async () => {
      mockStudyMind(() => { throw new TypeError("fetch failed"); });
      const s = await makeUser(); signIn(s); await makePass(s.id, { policy: true });
      const body = (await (await status()).json()).data;
      expect(body.current).not.toBeNull();
      expect(body.usageAvailable).toBe(false);
    });

    it("last state is the pass that most recently stopped (an expiry after an older refund shows as expired)", async () => {
      const s = await makeUser(); signIn(s);
      const refunded = await makePass(s.id, { endOffsetMs: 20 * DAY_MS });   // original end still in the future
      await db.update(aiTutorPasses).set({ revokedAt: new Date(Date.now() - 2 * DAY_MS), revokeReason: "refunded" }).where(eq(aiTutorPasses.id, refunded.id));
      const expired = await makePass(s.id, { startOffsetMs: -30 * DAY_MS, endOffsetMs: -60_000 });
      const body = (await (await status()).json()).data;
      expect(body.last).toMatchObject({ passId: expired.id, state: "expired" });
    });

    it("shows a refunded pass as the last state", async () => {
      const s = await makeUser(); signIn(s); await makePass(s.id, { revoked: true });
      const body = (await (await status()).json()).data;
      expect(body.current).toBeNull();
      expect(body.last.state).toBe("refunded");
    });
  });

  describe("GET /api/cron/ai-pass-revocations", () => {
    const req = (auth?: string) => new Request("https://learnify.test/api/cron/ai-pass-revocations", { headers: auth ? { authorization: auth } : {} }) as never;
    it("requires the cron secret", async () => {
      expect((await cron(req())).status).toBe(401);
      expect((await cron(req("Bearer wrong"))).status).toBe(401);
    });
    it("retries due revocations", async () => {
      mockStudyMind(() => json(200, {}));
      const s = await makeUser(); const p = await makePass(s.id, { revoked: true });
      const { eq } = await import("drizzle-orm");
      await db.update(aiTutorPasses).set({ studymindRevokeStatus: "pending", studymindRevokeNextAttemptAt: new Date(0) }).where(eq(aiTutorPasses.id, p.id));
      const res = await cron(req("Bearer cron_test_secret"));
      expect((await res.json()).data.revocations).toEqual({ due: 1, done: 1, failed: 0 });
    });
    it("retries owed refunds", async () => {
      const s = await makeUser();
      for (const [a, b] of [[-1, 10], [10, 40], [40, 70]]) await makePass(s.id, { startOffsetMs: a * DAY_MS, endOffsetMs: b * DAY_MS });
      fake.failRefunds(new Error("down"));
      const { AiTutorPassService } = await import("@/services/ai-tutor-pass.service");
      const session = fake.pay(s.id);
      await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
      fake.failRefunds(null);
      await db.update(aiPassCheckouts).set({ refundNextAttemptAt: new Date(0) });
      const res = await cron(req("Bearer cron_test_secret"));
      expect((await res.json()).data.refunds).toEqual({ due: 1, done: 1, failed: 0 });
    });
  });

  describe("GET /api/ai-pass/admin/issues", () => {
    it("admins only", async () => {
      signIn(await makeUser("student"));
      expect((await adminIssues()).status).toBe(403);
      vi.mocked(auth).mockResolvedValue(null as never);
      expect((await adminIssues()).status).toBe(401);
    });
    it("lists payments needing review", async () => {
      const s = await makeUser();
      const session = fake.pay(s.id, { amount_total: 1 });
      const { AiTutorPassService } = await import("@/services/ai-tutor-pass.service");
      await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
      signIn(await makeUser("admin"));
      const body = (await (await adminIssues()).json()).data;
      expect(body.paymentsNeedingAttention).toHaveLength(1);
      expect(body.paymentsNeedingAttention[0]).toMatchObject({ checkoutSessionId: session.id, reason: "invalid", refundStatus: "manual_review" });
    });
  });
});
