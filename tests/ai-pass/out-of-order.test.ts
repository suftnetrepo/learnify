import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiPassCheckouts, aiTutorPasses } from "@/db/schema";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import { DAY_MS } from "@/lib/ai-pass/config";
import { fakeStripe, hasDb, json, makePass, makeUser, mockStudyMind, resetDb } from "../helpers";

const passesOf = (studentId: string) => db.select().from(aiTutorPasses).where(eq(aiTutorPasses.studentId, studentId));
const checkout = async (id: string) => (await db.select().from(aiPassCheckouts).where(eq(aiPassCheckouts.stripeCheckoutSessionId, id)))[0];
/** The invariant: a payment Stripe shows as refunded/disputed never backs a usable pass. */
async function noActiveReversedPass(studentId: string) {
  for (const p of await passesOf(studentId)) {
    if (p.paymentStatus === "refunded" || p.paymentStatus === "disputed") expect(p.revokedAt).not.toBeNull();
  }
  expect(await AiTutorPassService.currentPass(studentId)).toBeNull();
}

describe.skipIf(!hasDb)("out-of-order Stripe events", () => {
  let stripe: ReturnType<typeof fakeStripe>;
  beforeEach(async () => { await resetDb(); stripe = fakeStripe(); mockStudyMind(() => json(200, {})); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("charge.refunded before checkout.session.completed: the pass is never granted", async () => {
    const s = await makeUser(); const session = stripe.pay(s.id);
    const charge = stripe.refundAt(session.payment_intent as string);
    // Make Stripe's later read look stale (not refunded) — the recorded reversal alone must block it
    stripe.intents.get(session.payment_intent as string)!.latest_charge.refunded = false;
    stripe.intents.get(session.payment_intent as string)!.latest_charge.amount_refunded = 0;

    expect(await AiTutorPassService.handleRefund(charge)).toBe(true);
    expect(await checkout(session.id)).toMatchObject({ reversal: "refunded", stripePaymentIntentId: session.payment_intent });

    expect(await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook")).toMatchObject({ outcome: "rejected", reason: "refunded" });
    expect(await passesOf(s.id)).toHaveLength(0);
  });

  it("charge.dispute.created before checkout.session.completed: never granted", async () => {
    const s = await makeUser(); const session = stripe.pay(s.id);
    const dispute = stripe.disputeAt(session.payment_intent as string);
    stripe.intents.get(session.payment_intent as string)!.latest_charge.disputed = false;   // stale read
    await AiTutorPassService.handleDisputeCreated(dispute);
    expect(await AiTutorPassService.fulfilCheckoutSession(session.id, "confirm")).toMatchObject({ outcome: "rejected", reason: "disputed" });
    expect(await passesOf(s.id)).toHaveLength(0);
  });

  it("refund after fulfilment revokes; a re-delivered checkout.session.completed does not re-grant", async () => {
    const s = await makeUser(); const session = stripe.pay(s.id);
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    await AiTutorPassService.handleRefund(stripe.refundAt(session.payment_intent as string));
    const again = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(again.outcome === "granted" && again.pass.revokedAt).not.toBeNull();
    expect(await passesOf(s.id)).toHaveLength(1);
    await noActiveReversedPass(s.id);
  });

  it("a stale partial-refund event after a full refund cannot reactivate or lower the refunded amount", async () => {
    const s = await makeUser(); const session = stripe.pay(s.id);
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    const partial = stripe.refundAt(session.payment_intent as string, 300);
    const full = stripe.refundAt(session.payment_intent as string, 999);
    await AiTutorPassService.handleRefund(full);
    await AiTutorPassService.handleRefund(partial);   // delivered late
    const [p] = await passesOf(s.id);
    expect(p).toMatchObject({ paymentStatus: "refunded", refundedAmountPence: 999 });
    expect(p.revokedAt).not.toBeNull();
  });

  it("dispute won after revocation: stays revoked", async () => {
    const s = await makeUser(); const session = stripe.pay(s.id);
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    await AiTutorPassService.handleDisputeCreated(stripe.disputeAt(session.payment_intent as string));
    await AiTutorPassService.handleDisputeClosed({ ...stripe.disputeAt(session.payment_intent as string, "won") });
    const [p] = await passesOf(s.id);
    expect(p).toMatchObject({ disputeStatus: "won", paymentStatus: "disputed" });
    expect(p.revokedAt).not.toBeNull();
  });

  it("dispute closed before fulfilment is recorded on the checkout", async () => {
    const s = await makeUser(); const session = stripe.pay(s.id);
    await AiTutorPassService.handleDisputeCreated(stripe.disputeAt(session.payment_intent as string));
    expect(await AiTutorPassService.handleDisputeClosed(stripe.disputeAt(session.payment_intent as string, "lost"))).toBe(true);
    expect((await checkout(session.id)).disputeStatus).toBe("lost");
  });

  it("refund racing fulfilment (any interleaving) never leaves a usable refunded pass", async () => {
    for (let round = 0; round < 8; round++) {
      const s = await makeUser(); const session = stripe.pay(s.id);
      const charge = stripe.refundAt(session.payment_intent as string);
      // Half the rounds: Stripe's read inside fulfilment is stale, so only the lock + reversal protect it
      if (round % 2) {
        const c = stripe.intents.get(session.payment_intent as string)!.latest_charge;
        c.refunded = false; c.amount_refunded = 0;
      }
      await Promise.all([
        AiTutorPassService.fulfilCheckoutSession(session.id, "webhook"),
        AiTutorPassService.handleRefund(charge),
        AiTutorPassService.fulfilCheckoutSession(session.id, "confirm"),
      ]);
      await noActiveReversedPass(s.id);
    }
  });

  it("our automatic refund of a rejected payment is recognised when its charge.refunded arrives", async () => {
    const s = await makeUser();
    for (const [a, b] of [[-1, 10], [10, 40], [40, 70]]) await makePass(s.id, { startOffsetMs: a * DAY_MS, endOffsetMs: b * DAY_MS });
    stripe.failRefunds(new Error("timeout"));   // our call "failed" from our side…
    const session = stripe.pay(s.id);
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect((await checkout(session.id)).refundStatus).toBe("required");
    // …but Stripe processed a refund (e.g. an admin) and tells us
    expect(await AiTutorPassService.handleRefund(stripe.refundAt(session.payment_intent as string))).toBe(true);
    expect((await checkout(session.id)).refundStatus).toBe("refunded");
    expect(await passesOf(s.id)).toHaveLength(3);
  });

  it("a refund on an AI pass payment with no matching checkout or student is alerted, not dropped silently", async () => {
    stripe.intents.set("pi_orphan", {
      id: "pi_orphan", amount: 999, currency: "gbp", metadata: { app: "learnify", kind: "ai_tutor_pass", student_id: "nobody" },
      latest_charge: { amount: 999, amount_refunded: 999, refunded: true },
    } as never);
    const handled = await AiTutorPassService.handleRefund({ id: "ch", payment_intent: "pi_orphan", amount: 999, amount_refunded: 999, refunded: true } as never);
    expect(handled).toBe(true);
  });
});
