import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiPassCheckouts, aiTutorPasses } from "@/db/schema";
import { AiTutorPassService, PassFulfilmentError } from "@/services/ai-tutor-pass.service";
import { DAY_MS } from "@/lib/ai-pass/config";
import { fakeStripe, hasDb, makePass, makeUser, resetDb } from "../helpers";

const passesOf = (studentId: string) =>
  db.select().from(aiTutorPasses).where(eq(aiTutorPasses.studentId, studentId)).orderBy(aiTutorPasses.startsAt);
const checkout = async (id: string) => (await db.select().from(aiPassCheckouts).where(eq(aiPassCheckouts.stripeCheckoutSessionId, id)))[0];

describe.skipIf(!hasDb)("AI Tutor Pass fulfilment", () => {
  let stripe: ReturnType<typeof fakeStripe>;
  beforeEach(async () => { await resetDb(); stripe = fakeStripe(); });
  afterEach(() => { vi.restoreAllMocks(); process.env.STRIPE_AI_PASS_PRICE_ID = "price_ai_pass_test"; });

  it("grants a 30-day pass from a valid paid session and records the checkout as fulfilled", async () => {
    const s = await makeUser();
    const session = stripe.pay(s.id);
    const before = Date.now();
    const result = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook", "evt_1");
    expect(result.outcome).toBe("granted");
    if (result.outcome !== "granted") return;
    expect(result.created).toBe(true);
    expect(result.pass.amountPence).toBe(999);
    expect(result.pass.stripePaymentIntentId).toBe(session.payment_intent);
    expect(result.pass.startsAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(result.pass.endsAt.getTime() - result.pass.startsAt.getTime()).toBe(30 * DAY_MS);
    expect((await checkout(session.id)).status).toBe("fulfilled");
  });

  it("re-reads the session from Stripe (the event payload is not trusted)", async () => {
    const s = await makeUser();
    const session = stripe.pay(s.id);
    stripe.sessions.get(session.id)!.amount_total = 1;   // what Stripe really says
    const result = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(result).toMatchObject({ outcome: "rejected", reason: "invalid" });
    expect(stripe.spies.retrieve).toHaveBeenCalledWith(session.id);
  });

  it("is idempotent for the same session (webhook retry + confirm)", async () => {
    const s = await makeUser(); const session = stripe.pay(s.id);
    const a = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    const b = await AiTutorPassService.fulfilCheckoutSession(session.id, "confirm");
    expect(b).toMatchObject({ outcome: "granted", created: false });
    expect(a.outcome === "granted" && b.outcome === "granted" && a.pass.id === b.pass.id).toBe(true);
  });

  it("concurrent delivery of the same session (webhooks + confirm) creates exactly one pass", async () => {
    const s = await makeUser(); const session = stripe.pay(s.id);
    const results = await Promise.all([
      AiTutorPassService.fulfilCheckoutSession(session.id, "webhook"),
      AiTutorPassService.fulfilCheckoutSession(session.id, "confirm"),
      AiTutorPassService.fulfilCheckoutSession(session.id, "webhook"),
    ]);
    expect(results.filter((r) => r.outcome === "granted" && r.created)).toHaveLength(1);
    expect(await passesOf(s.id)).toHaveLength(1);
  });

  it("renewal queues after the current pass; the current pass is not modified", async () => {
    const s = await makeUser();
    const current = await makePass(s.id, { endOffsetMs: 5 * DAY_MS, policy: true });
    const result = await AiTutorPassService.fulfilCheckoutSession(stripe.pay(s.id).id, "webhook");
    expect(result.outcome === "granted" && result.pass.startsAt.getTime()).toBe(current.endsAt.getTime());
    const [after] = await db.select().from(aiTutorPasses).where(eq(aiTutorPasses.id, current.id));
    expect(after.endsAt.getTime()).toBe(current.endsAt.getTime());
    expect((await AiTutorPassService.currentPass(s.id))?.id).toBe(current.id);
  });

  it("a revoked pass does not delay a new purchase", async () => {
    const s = await makeUser();
    await makePass(s.id, { revoked: true });
    const before = Date.now();
    const result = await AiTutorPassService.fulfilCheckoutSession(stripe.pay(s.id).id, "webhook");
    expect(result.outcome === "granted" && result.pass.startsAt.getTime()).toBeLessThan(before + 5000);
  });

  describe("pass limit (one active + two queued)", () => {
    it("a payment completed after the limit is reached is recorded and refunded automatically", async () => {
      const s = await makeUser();
      await makePass(s.id, { endOffsetMs: 10 * DAY_MS });
      await makePass(s.id, { startOffsetMs: 10 * DAY_MS, endOffsetMs: 40 * DAY_MS });
      await makePass(s.id, { startOffsetMs: 40 * DAY_MS, endOffsetMs: 70 * DAY_MS });
      const session = stripe.pay(s.id);
      const result = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
      expect(result).toEqual({ outcome: "rejected", reason: "queue_full", refundStatus: "required" });
      expect(await passesOf(s.id)).toHaveLength(3);
      const row = await checkout(session.id);
      expect(row).toMatchObject({ status: "rejected", rejectReason: "queue_full", refundStatus: "refunded", stripePaymentIntentId: session.payment_intent });
      expect(row.stripeRefundId).toMatch(/^re_test_/);
      expect(stripe.refunds).toEqual([{ payment_intent: session.payment_intent, idempotencyKey: `ai-pass-refund-${session.id}` }]);
    });

    it("concurrent payments never exceed the limit; the extras are refunded, none are dropped", async () => {
      const s = await makeUser();
      const sessions = [1, 2, 3, 4, 5].map(() => stripe.pay(s.id));
      const results = await Promise.all(sessions.map((x) => AiTutorPassService.fulfilCheckoutSession(x.id, "webhook")));
      expect(results.filter((r) => r.outcome === "granted")).toHaveLength(3);
      expect(results.filter((r) => r.outcome === "rejected" && r.reason === "queue_full")).toHaveLength(2);
      const passes = await passesOf(s.id);
      expect(passes).toHaveLength(3);
      expect(passes[1].startsAt.getTime()).toBe(passes[0].endsAt.getTime());
      expect(passes[2].startsAt.getTime()).toBe(passes[1].endsAt.getTime());
      expect(stripe.refunds).toHaveLength(2);
      const rows = await db.select().from(aiPassCheckouts).where(eq(aiPassCheckouts.studentId, s.id));
      expect(rows).toHaveLength(5);
    });

    it("a re-delivered rejected payment stays rejected and is refunded only once", async () => {
      const s = await makeUser();
      for (const [a, b] of [[-1, 10], [10, 40], [40, 70]]) await makePass(s.id, { startOffsetMs: a * DAY_MS, endOffsetMs: b * DAY_MS });
      const session = stripe.pay(s.id);
      await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
      const again = await AiTutorPassService.fulfilCheckoutSession(session.id, "confirm");
      expect(again).toMatchObject({ outcome: "rejected", reason: "queue_full" });
      expect(stripe.refunds).toHaveLength(1);
    });

    it("a failed refund stays owed and is retried; an already-refunded charge counts as done", async () => {
      const s = await makeUser();
      for (const [a, b] of [[-1, 10], [10, 40], [40, 70]]) await makePass(s.id, { startOffsetMs: a * DAY_MS, endOffsetMs: b * DAY_MS });
      stripe.failRefunds(new Error("Stripe unavailable"));
      const session = stripe.pay(s.id);
      await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
      let row = await checkout(session.id);
      expect(row).toMatchObject({ refundStatus: "required", refundAttempts: 1, refundLastError: "Stripe unavailable" });

      stripe.failRefunds(null);
      stripe.refundAt(session.payment_intent as string);   // an admin refunded it by hand meanwhile
      await db.update(aiPassCheckouts).set({ refundNextAttemptAt: new Date(0) }).where(eq(aiPassCheckouts.stripeCheckoutSessionId, session.id));
      expect(await AiTutorPassService.processPendingRefunds()).toEqual({ due: 1, done: 1, failed: 0 });
      row = await checkout(session.id);
      expect(row.refundStatus).toBe("refunded");
      expect(stripe.refunds).toHaveLength(0);
    });
  });

  describe("payment state at Stripe is checked before granting", () => {
    it("fully refunded before fulfilment: recorded, no pass, no further refund", async () => {
      const s = await makeUser(); const session = stripe.pay(s.id);
      stripe.refundAt(session.payment_intent as string);
      expect(await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook")).toEqual({ outcome: "rejected", reason: "refunded", refundStatus: "not_required" });
      expect(await passesOf(s.id)).toHaveLength(0);
      expect(stripe.refunds).toHaveLength(0);
    });

    it("disputed before fulfilment: no pass", async () => {
      const s = await makeUser(); const session = stripe.pay(s.id);
      stripe.disputeAt(session.payment_intent as string);
      expect(await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook")).toMatchObject({ outcome: "rejected", reason: "disputed" });
      expect(await passesOf(s.id)).toHaveLength(0);
    });

    it("partially refunded before fulfilment: granted, partial refund recorded", async () => {
      const s = await makeUser(); const session = stripe.pay(s.id);
      stripe.refundAt(session.payment_intent as string, 300);
      const result = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
      expect(result.outcome === "granted" && result.pass).toMatchObject({ paymentStatus: "partially_refunded", refundedAmountPence: 300 });
    });

    it("payment intent not succeeded: not granted, left for the async-payment event", async () => {
      const s = await makeUser(); const session = stripe.pay(s.id, {}, { status: "processing" });
      await expect(AiTutorPassService.fulfilCheckoutSession(session.id, "webhook")).rejects.toMatchObject({ code: "not_paid" });
      expect(await passesOf(s.id)).toHaveLength(0);
    });

    it("payment intent amount or owner differs: recorded for manual review", async () => {
      const s = await makeUser(), other = await makeUser();
      const a = stripe.pay(s.id, {}, { amount: 100 });
      const b = stripe.pay(s.id, {}, { metadata: { app: "learnify", kind: "ai_tutor_pass", student_id: other.id } });
      for (const x of [a, b]) {
        expect(await AiTutorPassService.fulfilCheckoutSession(x.id, "webhook")).toMatchObject({ outcome: "rejected", reason: "invalid", refundStatus: "manual_review" });
      }
      expect(await passesOf(s.id)).toHaveLength(0);
    });
  });

  describe("sessions that must not grant a pass", () => {
    const invalid: [string, (id: string) => Record<string, unknown>][] = [
      ["wrong amount",       () => ({ amount_total: 1 })],
      ["zero amount",        () => ({ amount_total: 0 })],
      ["wrong currency",     () => ({ currency: "usd" })],
      ["subscription mode",  () => ({ mode: "subscription" })],
      ["owner mismatch",     () => ({ client_reference_id: "00000000-0000-0000-0000-000000000000" })],
    ];
    for (const [name, over] of invalid) {
      it(`${name}: recorded as invalid for manual review, no pass`, async () => {
        const s = await makeUser();
        const session = stripe.pay(s.id, over(s.id));
        expect(await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook")).toMatchObject({ outcome: "rejected", reason: "invalid", refundStatus: "manual_review" });
        expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
      });
    }

    const items: [string, Parameters<typeof fakeStripe>[0]][] = [
      ["different price id",  { lineItem: { price: "price_other" } }],
      ["quantity 2",          { lineItem: { quantity: 2 } }],
      ["two line items",      { lineItem: { count: 2 } }],
      ["line amount differs", { lineItem: { amount: 500 } }],
    ];
    for (const [name, opts] of items) {
      it(`${name}: invalid`, async () => {
        vi.restoreAllMocks(); stripe = fakeStripe(opts);
        const s = await makeUser();
        expect(await AiTutorPassService.fulfilCheckoutSession(stripe.pay(s.id).id, "webhook")).toMatchObject({ outcome: "rejected", reason: "invalid" });
      });
    }

    it("purchaser is not a student: invalid", async () => {
      const t = await makeUser("tutor");
      expect(await AiTutorPassService.fulfilCheckoutSession(stripe.pay(t.id).id, "webhook")).toMatchObject({ outcome: "rejected", reason: "invalid" });
    });

    it("unpaid session: not granted, not recorded", async () => {
      const s = await makeUser(); const session = stripe.pay(s.id, { payment_status: "unpaid" });
      await expect(AiTutorPassService.fulfilCheckoutSession(session.id, "webhook")).rejects.toMatchObject({ code: "not_paid" });
    });

    it("not a pass session", async () => {
      const s = await makeUser(); const session = stripe.pay(s.id, { metadata: { courseId: "x", studentId: s.id } });
      await expect(AiTutorPassService.fulfilCheckoutSession(session.id, "webhook")).rejects.toMatchObject({ code: "not_pass" });
    });

    it("no identifiable student: alerted, not granted", async () => {
      const s = await makeUser();
      const session = stripe.pay(s.id, { metadata: { app: "learnify", kind: "ai_tutor_pass", student_id: "not-a-uuid" } });
      await expect(AiTutorPassService.fulfilCheckoutSession(session.id, "webhook")).rejects.toBeInstanceOf(PassFulfilmentError);
      expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
    });

    it("price not configured: transient error (retried), never a rejected payment", async () => {
      delete process.env.STRIPE_AI_PASS_PRICE_ID;
      const s = await makeUser(); const session = stripe.pay(s.id);
      await expect(AiTutorPassService.fulfilCheckoutSession(session.id, "webhook")).rejects.not.toBeInstanceOf(PassFulfilmentError);
      expect(await db.select().from(aiPassCheckouts)).toHaveLength(0);
    });
  });
});

describe.skipIf(!hasDb)("UK-only launch", () => {
  let stripe: ReturnType<typeof fakeStripe>;
  beforeEach(async () => { await resetDb(); stripe = fakeStripe(); });
  afterEach(() => { vi.restoreAllMocks(); });

  for (const [name, change] of [
    ["non-UK billing address", (c: Record<string, unknown>) => { c.billing_details = { address: { country: "US" } }; }],
    ["non-UK card",            (c: Record<string, unknown>) => { c.payment_method_details = { type: "card", card: { country: "FR" } }; }],
    ["missing country data",   (c: Record<string, unknown>) => { c.billing_details = { address: {} }; }],
  ] as const) {
    it(`${name}: no pass, recorded and refunded automatically`, async () => {
      const s = await makeUser(); const session = stripe.pay(s.id);
      change(stripe.intents.get(session.payment_intent as string)!.latest_charge as never);
      expect(await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook")).toEqual({ outcome: "rejected", reason: "outside_uk", refundStatus: "required" });
      expect(await passesOf(s.id)).toHaveLength(0);
      expect((await checkout(session.id)).refundStatus).toBe("refunded");
      expect(stripe.refunds).toHaveLength(1);
    });
  }

  it("UK billing address and UK card: granted", async () => {
    const s = await makeUser();
    expect((await AiTutorPassService.fulfilCheckoutSession(stripe.pay(s.id).id, "webhook")).outcome).toBe("granted");
  });
});
