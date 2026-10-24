import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
vi.mock("@/services/email.service", () => ({
  EmailService: { purchaseConfirmation: vi.fn(), disputeAlert: vi.fn(), paymentFailed: vi.fn(), buildAiTutorPassConfirmation: vi.fn(() => ({ subject: "s", html: "<p>h</p>" })), aiPassOpsAlert: vi.fn() },
}));
import { EmailService } from "@/services/email.service";
import { stripe } from "@/lib/stripe";
import { POST } from "@/app/api/webhooks/stripe/route";
import { db } from "@/db";
import { aiTutorPasses, enrollments, purchases } from "@/db/schema";
import { fakeStripe, hasDb, json, makeCourse, makePass, makeUser, mockStudyMind, passSession, resetDb } from "../helpers";

let n = 0;
function deliver(type: string, object: unknown, opts: { secret?: string } = {}) {
  const payload = JSON.stringify({ id: `evt_test_${Date.now()}_${n++}`, object: "event", type, data: { object }, api_version: "2026-07-29.dahlia", created: Math.floor(Date.now() / 1000) });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? process.env.STRIPE_WEBHOOK_SECRET! });
  return POST(new Request("https://learnify.test/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": signature }, body: payload }) as never);
}

describe.skipIf(!hasDb)("Stripe webhook", () => {
  let fake: ReturnType<typeof fakeStripe>;
  beforeEach(async () => { await resetDb(); fake = fakeStripe(); vi.mocked(EmailService.disputeAlert).mockClear(); vi.mocked(EmailService.purchaseConfirmation).mockClear(); vi.mocked(EmailService.buildAiTutorPassConfirmation).mockClear(); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete process.env.ADMIN_EMAIL; delete process.env.CAREERMIND_API_URL; });

  it("rejects a bad signature without touching anything", async () => {
    const s = await makeUser();
    const res = await deliver("checkout.session.completed", passSession(s.id), { secret: "whsec_wrong" });
    expect(res.status).toBe(400);
    expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
  });

  it("pass checkout.session.completed grants the pass (flag off too — fulfilment is never lost)", async () => {
    const s = await makeUser();
    expect((await deliver("checkout.session.completed", fake.pay(s.id))).status).toBe(200);
    const rows = await db.select().from(aiTutorPasses);
    expect(rows).toHaveLength(1);
    expect(rows[0].fulfilledVia).toBe("webhook");
    expect(EmailService.buildAiTutorPassConfirmation).toHaveBeenCalledOnce();
    expect(EmailService.purchaseConfirmation).not.toHaveBeenCalled();
    expect(rows[0].stripeEventId).toMatch(/^evt_test_/);
  });

  it("concurrent duplicate deliveries create one pass", async () => {
    const s = await makeUser(); const session = fake.pay(s.id);
    const codes = await Promise.all([1, 2, 3].map(() => deliver("checkout.session.completed", session).then((r) => r.status)));
    expect(codes).toEqual([200, 200, 200]);
    expect(await db.select().from(aiTutorPasses)).toHaveLength(1);
  });

  it("an invalid pass session is acknowledged (200), grants nothing, and is recorded for review", async () => {
    vi.restoreAllMocks(); fake = fakeStripe({ lineItem: { price: "price_other" } });
    const s = await makeUser();
    expect((await deliver("checkout.session.completed", fake.pay(s.id))).status).toBe(200);
    expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
    const { aiPassCheckouts } = await import("@/db/schema");
    expect((await db.select().from(aiPassCheckouts))[0]).toMatchObject({ status: "rejected", refundStatus: "manual_review" });
  });

  it("a forged payload is ignored: the session is re-read from Stripe", async () => {
    const s = await makeUser();
    const real = fake.pay(s.id, { payment_status: "unpaid" });
    expect((await deliver("checkout.session.completed", { ...real, payment_status: "paid" })).status).toBe(200);
    expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
  });

  it("refund delivered before checkout.session.completed: pass never granted", async () => {
    mockStudyMind(() => json(200, {}));
    const s = await makeUser(); const session = fake.pay(s.id);
    const charge = fake.refundAt(session.payment_intent as string);
    expect((await deliver("charge.refunded", charge)).status).toBe(200);
    expect((await deliver("checkout.session.completed", session)).status).toBe(200);
    expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
  });

  it("a transient failure returns 500 so Stripe retries", async () => {
    const s = await makeUser(); const session = fake.pay(s.id);
    fake.spies.lineItems.mockRejectedValue(new Error("Stripe API down"));
    expect((await deliver("checkout.session.completed", session)).status).toBe(500);
  });

  it("existing course checkout is unchanged: purchase completed, enrolment granted, no pass", async () => {
    const lineItems = fake.spies.lineItems;
    const s = await makeUser(); const c = await makeCourse("25.00");
    const [p] = await db.insert(purchases).values({ studentId: s.id, courseId: c.id, amount: "25.00", platformFee: "5.00", tutorAmount: "20.00", stripeSessionId: "cs_test_course_1" }).returning();
    const res = await deliver("checkout.session.completed", {
      id: "cs_test_course_1", object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 2500, currency: "gbp",
      payment_intent: "pi_course_1", metadata: { courseId: c.id, studentId: s.id },
    });
    expect(res.status).toBe(200);
    const [after] = await db.select().from(purchases).where(eq(purchases.id, p.id));
    expect(after.status).toBe("completed");
    expect(after.stripePaymentIntentId).toBe("pi_course_1");
    expect(await db.select().from(enrollments).where(eq(enrollments.studentId, s.id))).toHaveLength(1);
    expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
    expect(lineItems).not.toHaveBeenCalled();
    expect(fake.spies.retrieve).not.toHaveBeenCalled();
    expect(EmailService.purchaseConfirmation).toHaveBeenCalledOnce();
    expect(EmailService.buildAiTutorPassConfirmation).not.toHaveBeenCalled();   // course emails unchanged, no pass email
  });

  it("Tranquis events are still forwarded and never reach the pass handler", async () => {
    process.env.CAREERMIND_API_URL = "https://careermind.test";
    const sm = mockStudyMind(() => json(200, {}));
    const handle = vi.spyOn((await import("@/services/ai-tutor-pass.service")).AiTutorPassService, "handleStripeEvent");
    const res = await deliver("checkout.session.completed", { id: "cs_tq", object: "checkout.session", metadata: { app: "tranquis", kind: "ai_tutor_pass" } });
    expect(res.status).toBe(200);
    expect(sm.calls[0].url).toBe("https://careermind.test/tranquis/webhooks/stripe");
    expect(handle).not.toHaveBeenCalled();
  });

  it("charge.refunded (full) revokes the pass", async () => {
    mockStudyMind(() => json(200, {}));
    const s = await makeUser(); const p = await makePass(s.id);
    expect((await deliver("charge.refunded", { id: "ch_1", object: "charge", payment_intent: p.stripePaymentIntentId, amount: 999, amount_refunded: 999 })).status).toBe(200);
    expect((await db.select().from(aiTutorPasses).where(eq(aiTutorPasses.id, p.id)))[0].revokedAt).not.toBeNull();
  });

  it("charge.refunded for a course purchase is ignored as before", async () => {
    const s = await makeUser(); const c = await makeCourse("25.00");
    await db.insert(purchases).values({ studentId: s.id, courseId: c.id, amount: "25.00", platformFee: "5.00", tutorAmount: "20.00", status: "completed", stripePaymentIntentId: "pi_course_x" });
    const res = await deliver("charge.refunded", { id: "ch_c", object: "charge", payment_intent: "pi_course_x", amount: 2500, amount_refunded: 2500, refunded: true });
    expect(res.status).toBe(200);
    expect(fake.spies.piRetrieve).not.toHaveBeenCalled();
  });

  it("pass dispute revokes AND still sends the existing admin alert", async () => {
    process.env.ADMIN_EMAIL = "admin@test.local";
    mockStudyMind(() => json(200, {}));
    const s = await makeUser(); const p = await makePass(s.id);
    const res = await deliver("charge.dispute.created", { id: "dp_1", object: "dispute", payment_intent: p.stripePaymentIntentId, amount: 999, status: "needs_response", reason: "fraudulent" });
    expect(res.status).toBe(200);
    expect((await db.select().from(aiTutorPasses).where(eq(aiTutorPasses.id, p.id)))[0].revokeReason).toBe("disputed");
    expect(EmailService.disputeAlert).toHaveBeenCalledOnce();
  });

  it("course dispute: existing admin alert only", async () => {
    process.env.ADMIN_EMAIL = "admin@test.local";
    const s = await makeUser(); const c = await makeCourse("25.00");
    await db.insert(purchases).values({ studentId: s.id, courseId: c.id, amount: "25.00", platformFee: "5.00", tutorAmount: "20.00", status: "completed", stripePaymentIntentId: "pi_course_y" });
    const res = await deliver("charge.dispute.created", { id: "dp_c", object: "dispute", payment_intent: "pi_course_y", amount: 2500, status: "needs_response", reason: "general" });
    expect(res.status).toBe(200);
    expect(EmailService.disputeAlert).toHaveBeenCalledOnce();
    expect(fake.spies.piRetrieve).not.toHaveBeenCalled();
  });
});
