import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
vi.mock("@/services/email.service", () => ({
  EmailService: { purchaseConfirmation: vi.fn(), disputeAlert: vi.fn(), paymentFailed: vi.fn() },
}));
import { EmailService } from "@/services/email.service";
import { stripe } from "@/lib/stripe";
import { POST } from "@/app/api/webhooks/stripe/route";
import { db } from "@/db";
import { aiTutorPasses, enrollments, purchases } from "@/db/schema";
import { hasDb, json, makeCourse, makePass, makeUser, mockLineItems, mockStudyMind, passSession, resetDb } from "../helpers";

let n = 0;
function deliver(type: string, object: unknown, opts: { secret?: string } = {}) {
  const payload = JSON.stringify({ id: `evt_test_${Date.now()}_${n++}`, object: "event", type, data: { object }, api_version: "2026-07-29.dahlia", created: Math.floor(Date.now() / 1000) });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? process.env.STRIPE_WEBHOOK_SECRET! });
  return POST(new Request("https://learnify.test/api/webhooks/stripe", { method: "POST", headers: { "stripe-signature": signature }, body: payload }) as never);
}

describe.skipIf(!hasDb)("Stripe webhook", () => {
  beforeEach(async () => { await resetDb(); vi.mocked(EmailService.disputeAlert).mockClear(); vi.mocked(EmailService.purchaseConfirmation).mockClear(); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete process.env.ADMIN_EMAIL; delete process.env.CAREERMIND_API_URL; });

  it("rejects a bad signature without touching anything", async () => {
    const s = await makeUser();
    const res = await deliver("checkout.session.completed", passSession(s.id), { secret: "whsec_wrong" });
    expect(res.status).toBe(400);
    expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
  });

  it("pass checkout.session.completed grants the pass (flag off too — fulfilment is never lost)", async () => {
    mockLineItems();
    const s = await makeUser();
    expect((await deliver("checkout.session.completed", passSession(s.id))).status).toBe(200);
    const rows = await db.select().from(aiTutorPasses);
    expect(rows).toHaveLength(1);
    expect(rows[0].fulfilledVia).toBe("webhook");
    expect(rows[0].stripeEventId).toMatch(/^evt_test_/);
  });

  it("concurrent duplicate deliveries create one pass", async () => {
    mockLineItems();
    const s = await makeUser(); const session = passSession(s.id);
    const codes = await Promise.all([1, 2, 3].map(() => deliver("checkout.session.completed", session).then((r) => r.status)));
    expect(codes).toEqual([200, 200, 200]);
    expect(await db.select().from(aiTutorPasses)).toHaveLength(1);
  });

  it("an invalid pass session is acknowledged (200) but grants nothing", async () => {
    mockLineItems({ price: "price_other" });
    const s = await makeUser();
    expect((await deliver("checkout.session.completed", passSession(s.id))).status).toBe(200);
    expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
  });

  it("a transient failure returns 500 so Stripe retries", async () => {
    vi.spyOn(stripe.checkout.sessions, "listLineItems").mockRejectedValue(new Error("Stripe API down"));
    const s = await makeUser();
    expect((await deliver("checkout.session.completed", passSession(s.id))).status).toBe(500);
  });

  it("existing course checkout is unchanged: purchase completed, enrolment granted, no pass", async () => {
    const lineItems = vi.spyOn(stripe.checkout.sessions, "listLineItems");
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
    expect(EmailService.purchaseConfirmation).toHaveBeenCalledOnce();
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
    const res = await deliver("charge.refunded", { id: "ch_c", object: "charge", payment_intent: "pi_course_x", amount: 2500, amount_refunded: 2500 });
    expect(res.status).toBe(200);
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
    const res = await deliver("charge.dispute.created", { id: "dp_c", object: "dispute", payment_intent: "pi_course_y", amount: 2500, status: "needs_response", reason: "general" });
    expect(res.status).toBe(200);
    expect(EmailService.disputeAlert).toHaveBeenCalledOnce();
  });
});
