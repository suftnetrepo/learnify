import type Stripe from "stripe";
import { db } from "@/db";
import { aiTutorPasses, courses, enrollments, purchases, users, type AiTutorPass } from "@/db/schema";
import { and, asc, desc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { AI_PASS, AI_PASS_METADATA, DAY_MS, aiPassPriceId } from "@/lib/ai-pass/config";
import { getPolicyStatus, revokePolicy, type StudyMindPolicyStatus } from "@/lib/ai-pass/studymind";
import { log } from "@/lib/logger";

/** A Checkout Session that must not grant a pass (wrong price, unpaid, wrong owner...). */
export class PassFulfilmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PassFulfilmentError";
  }
}

const VALID_PAYMENT = ["paid", "partially_refunded"] as const;
const REVOKE_BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockStudent(tx: Tx, studentId: string) {
  // Serialises everything that computes a student's pass periods (purchases, revocations)
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"ai_pass:" + studentId}))`);
}

const isAiPassObject = (obj: { metadata?: Stripe.Metadata | null } | null | undefined) =>
  obj?.metadata?.app === AI_PASS_METADATA.app && obj?.metadata?.kind === AI_PASS_METADATA.kind;

export class AiTutorPassService {
  // ─── Queries ────────────────────────────────────────────────────────────────

  /** The pass covering `now` (with more than minUsableSeconds left), or null. */
  static async currentPass(studentId: string, now = new Date()): Promise<AiTutorPass | null> {
    const usableUntil = new Date(now.getTime() + AI_PASS.minUsableSeconds * 1000);
    const [pass] = await db
      .select()
      .from(aiTutorPasses)
      .where(and(
        eq(aiTutorPasses.studentId, studentId),
        isNull(aiTutorPasses.revokedAt),
        inArray(aiTutorPasses.paymentStatus, [...VALID_PAYMENT]),
        lte(aiTutorPasses.startsAt, now),
        gt(aiTutorPasses.endsAt, usableUntil),
      ))
      .orderBy(asc(aiTutorPasses.startsAt))
      .limit(1);
    return pass ?? null;
  }

  /** Not-yet-started, non-revoked passes, in start order. */
  static async queuedPasses(studentId: string, now = new Date()): Promise<AiTutorPass[]> {
    return db
      .select()
      .from(aiTutorPasses)
      .where(and(eq(aiTutorPasses.studentId, studentId), isNull(aiTutorPasses.revokedAt), gt(aiTutorPasses.startsAt, now)))
      .orderBy(asc(aiTutorPasses.startsAt));
  }

  /** The student bought this (now free) course for real money — keeps unrestricted AI access. */
  static async hasGenuinePaidPurchase(studentId: string, courseId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: purchases.id })
      .from(purchases)
      .where(and(
        eq(purchases.studentId, studentId),
        eq(purchases.courseId, courseId),
        eq(purchases.status, "completed"),
        gt(purchases.amount, "0"),      // a zero-value (free) enrolment never qualifies
      ))
      .limit(1);
    return !!row;
  }

  /** Enrolled in this course, and it's free (price 0) without a genuine paid purchase. */
  static async isEnrolledInFreeCourse(studentId: string, courseId: string): Promise<boolean> {
    const [row] = await db
      .select({ price: courses.price })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
      .limit(1);
    if (!row || Number(row.price) !== 0) return false;
    return !(await AiTutorPassService.hasGenuinePaidPurchase(studentId, courseId));
  }

  // ─── Fulfilment ─────────────────────────────────────────────────────────────

  /**
   * Validate a Checkout Session against what we sell: paid, one-time, our Price, the expected
   * amount/currency, a single item, and owned by an existing student. Returns the student id.
   */
  static async validateSession(session: Stripe.Checkout.Session): Promise<string> {
    const priceId = aiPassPriceId();
    if (!priceId) throw new PassFulfilmentError("AI Tutor Pass price is not configured");
    if (!isAiPassObject(session)) throw new PassFulfilmentError("Not an AI Tutor Pass session");
    if (session.mode !== "payment") throw new PassFulfilmentError("Not a one-time payment");
    if (session.payment_status !== "paid") throw new PassFulfilmentError(`Payment not completed (${session.payment_status})`);
    if (session.currency !== AI_PASS.currency || session.amount_total !== AI_PASS.pricePence) {
      throw new PassFulfilmentError(`Unexpected amount ${session.amount_total} ${session.currency}`);
    }

    const studentId = session.metadata?.student_id;
    if (!studentId || session.client_reference_id !== studentId) {
      throw new PassFulfilmentError("Session owner mismatch");
    }

    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
    const [item] = items.data;
    if (items.data.length !== 1 || item.quantity !== 1 || item.price?.id !== priceId
        || item.amount_total !== AI_PASS.pricePence || item.currency !== AI_PASS.currency) {
      throw new PassFulfilmentError("Line items do not match the AI Tutor Pass price");
    }

    const [student] = await db.select({ role: users.role }).from(users).where(eq(users.id, studentId)).limit(1);
    if (!student || student.role !== "student") throw new PassFulfilmentError("Purchaser is not a student");
    return studentId;
  }

  /**
   * Grant the pass for a paid Checkout Session — idempotent (one pass per session) and safe under
   * concurrent delivery (webhook + the success-page confirmation, or two purchases at once).
   * A repurchase starts when the student's latest pass ends.
   */
  static async fulfilCheckoutSession(
    session: Stripe.Checkout.Session, via: "webhook" | "confirm", eventId?: string,
  ): Promise<{ pass: AiTutorPass; created: boolean }> {
    const studentId = await AiTutorPassService.validateSession(session);
    const consentAt = session.metadata?.consent_at ? new Date(session.metadata.consent_at) : null;

    return db.transaction(async (tx) => {
      await lockStudent(tx, studentId);

      const [existing] = await tx.select().from(aiTutorPasses)
        .where(eq(aiTutorPasses.stripeCheckoutSessionId, session.id)).limit(1);
      if (existing) return { pass: existing, created: false };

      const now = new Date();
      const [latest] = await tx
        .select({ endsAt: aiTutorPasses.endsAt })
        .from(aiTutorPasses)
        .where(and(eq(aiTutorPasses.studentId, studentId), isNull(aiTutorPasses.revokedAt), gt(aiTutorPasses.endsAt, now)))
        .orderBy(desc(aiTutorPasses.endsAt))
        .limit(1);
      const startsAt = latest ? latest.endsAt : now;
      const endsAt   = new Date(startsAt.getTime() + AI_PASS.durationDays * DAY_MS);

      const [pass] = await tx.insert(aiTutorPasses).values({
        studentId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:   typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null,
        stripePriceId:           aiPassPriceId()!,
        stripeEventId:           eventId ?? null,
        fulfilledVia:            via,
        amountPence:             session.amount_total!,
        currency:                session.currency!,
        consentAt:               consentAt && !isNaN(consentAt.getTime()) ? consentAt : null,
        purchasedAt:             now,
        startsAt,
        endsAt,
      }).returning();

      log.info("AI Tutor Pass granted", { passId: pass.id, studentId, via, startsAt, endsAt });
      return { pass, created: true };
    });
  }

  // ─── Refunds, disputes, revocation ──────────────────────────────────────────

  static async findByPaymentIntent(paymentIntentId: string | null | undefined): Promise<AiTutorPass | null> {
    if (!paymentIntentId) return null;
    const [pass] = await db.select().from(aiTutorPasses)
      .where(eq(aiTutorPasses.stripePaymentIntentId, paymentIntentId)).limit(1);
    return pass ?? null;
  }

  /**
   * Revoke in Learnify first (no new tokens from this moment), queue the StudyMind revocation,
   * and move later, not-yet-started passes forward. A revoked pass is never re-activated.
   */
  static async revoke(passId: string, reason: string, fields: Partial<typeof aiTutorPasses.$inferInsert> = {}) {
    await db.transaction(async (tx) => {
      const [pass] = await tx.select().from(aiTutorPasses).where(eq(aiTutorPasses.id, passId)).limit(1);
      if (!pass) return;
      await lockStudent(tx, pass.studentId);
      const now = new Date();
      await tx.update(aiTutorPasses).set({
        ...fields,
        revokedAt:    pass.revokedAt ?? now,
        revokeReason: pass.revokeReason ?? reason,
        ...(pass.studymindRevokeStatus === "done" ? {} : {
          studymindRevokeStatus: "pending" as const, studymindRevokeNextAttemptAt: now,
        }),
        updatedAt: now,
      }).where(eq(aiTutorPasses.id, passId));
      await AiTutorPassService.rechainQueued(tx, pass.studentId, now);
    });
    await AiTutorPassService.processPendingRevocations({ passId });
  }

  /** Close the gap left by a revoked pass: unstarted passes (no StudyMind policy yet) move forward. */
  private static async rechainQueued(tx: Tx, studentId: string, now: Date) {
    const [active] = await tx
      .select({ endsAt: aiTutorPasses.endsAt })
      .from(aiTutorPasses)
      .where(and(eq(aiTutorPasses.studentId, studentId), isNull(aiTutorPasses.revokedAt),
                 lte(aiTutorPasses.startsAt, now), gt(aiTutorPasses.endsAt, now)))
      .orderBy(desc(aiTutorPasses.endsAt))
      .limit(1);
    const queued = await tx.select().from(aiTutorPasses)
      .where(and(eq(aiTutorPasses.studentId, studentId), isNull(aiTutorPasses.revokedAt),
                 gt(aiTutorPasses.startsAt, now), isNull(aiTutorPasses.studymindPolicyCreatedAt)))
      .orderBy(asc(aiTutorPasses.startsAt));

    let cursor = active ? active.endsAt : now;
    for (const p of queued) {
      if (p.startsAt.getTime() !== cursor.getTime()) {
        await tx.update(aiTutorPasses).set({
          startsAt: cursor, endsAt: new Date(cursor.getTime() + AI_PASS.durationDays * DAY_MS), updatedAt: now,
        }).where(eq(aiTutorPasses.id, p.id));
      }
      cursor = new Date(cursor.getTime() + AI_PASS.durationDays * DAY_MS);
    }
  }

  /** charge.refunded — full refund revokes; partial refund is recorded only. */
  static async handleRefund(charge: Stripe.Charge): Promise<boolean> {
    const pass = await AiTutorPassService.findByPaymentIntent(
      typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id);
    if (!pass) return false;

    const refunded = charge.amount_refunded ?? 0;
    if (refunded >= pass.amountPence) {
      await AiTutorPassService.revoke(pass.id, "refunded", { paymentStatus: "refunded", refundedAmountPence: refunded });
      log.info("AI Tutor Pass revoked after full refund", { passId: pass.id });
    } else {
      await db.update(aiTutorPasses).set({
        refundedAmountPence: refunded,
        // never downgrade a revoked/disputed pass back to a usable status
        ...(pass.revokedAt ? {} : { paymentStatus: "partially_refunded" as const }),
        updatedAt: new Date(),
      }).where(eq(aiTutorPasses.id, pass.id));
      log.warn("AI Tutor Pass partially refunded — access kept", { passId: pass.id, refunded });
    }
    return true;
  }

  /** charge.dispute.created — revoke at once (won disputes stay revoked pending manual restoration). */
  static async handleDisputeCreated(dispute: Stripe.Dispute): Promise<boolean> {
    const pass = await AiTutorPassService.findByPaymentIntent(
      typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id);
    if (!pass) return false;
    await AiTutorPassService.revoke(pass.id, "disputed", {
      paymentStatus: "disputed", disputeId: dispute.id, disputeStatus: dispute.status,
    });
    log.warn("AI Tutor Pass revoked after dispute", { passId: pass.id, disputeId: dispute.id });
    return true;
  }

  /** charge.dispute.closed — record the outcome only; the pass stays revoked. */
  static async handleDisputeClosed(dispute: Stripe.Dispute): Promise<boolean> {
    const pass = await AiTutorPassService.findByPaymentIntent(
      typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id);
    if (!pass) return false;
    await db.update(aiTutorPasses).set({ disputeStatus: dispute.status, updatedAt: new Date() })
      .where(eq(aiTutorPasses.id, pass.id));
    return true;
  }

  /**
   * Retry queued StudyMind revocations (idempotent; safe to run concurrently). Only ever moves
   * studymind_revoke_status forward — a failure never touches the Learnify revocation.
   */
  static async processPendingRevocations(opts: { passId?: string; limit?: number } = {}) {
    const now = new Date();
    const due = await db.select().from(aiTutorPasses)
      .where(and(
        eq(aiTutorPasses.studymindRevokeStatus, "pending"),
        lte(aiTutorPasses.studymindRevokeNextAttemptAt, now),
        opts.passId ? eq(aiTutorPasses.id, opts.passId) : undefined,
      ))
      .limit(opts.limit ?? 25);

    let done = 0, failed = 0;
    for (const pass of due) {
      try {
        const outcome = await revokePolicy(pass.id, pass.studentId, pass.revokeReason ?? "revoked");
        await db.update(aiTutorPasses).set({
          studymindRevokeStatus: "done", studymindRevokedAt: new Date(), studymindRevokeLastError: null,
          studymindRevokeNextAttemptAt: null, updatedAt: new Date(),
        }).where(and(eq(aiTutorPasses.id, pass.id), eq(aiTutorPasses.studymindRevokeStatus, "pending")));
        log.info("StudyMind policy revocation complete", { passId: pass.id, outcome });
        done++;
      } catch (error) {
        const attempts = pass.studymindRevokeAttempts + 1;
        const delay = Math.min(60_000 * 2 ** Math.min(attempts, 10), REVOKE_BACKOFF_MAX_MS);
        await db.update(aiTutorPasses).set({
          studymindRevokeAttempts:      attempts,
          studymindRevokeLastError:     error instanceof Error ? error.message.slice(0, 500) : String(error),
          studymindRevokeNextAttemptAt: new Date(Date.now() + delay),
          updatedAt:                    new Date(),
        }).where(and(eq(aiTutorPasses.id, pass.id), eq(aiTutorPasses.studymindRevokeStatus, "pending")));
        log.error("StudyMind policy revocation failed — will retry", { passId: pass.id, attempts, error });
        failed++;
      }
    }
    return { due: due.length, done, failed };
  }

  /** First successful pass token for this pass — StudyMind now holds a policy for it. */
  static async markPolicyCreated(passId: string) {
    await db.update(aiTutorPasses).set({ studymindPolicyCreatedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(aiTutorPasses.id, passId), isNull(aiTutorPasses.studymindPolicyCreatedAt)));
  }

  // ─── Stripe webhook routing ─────────────────────────────────────────────────

  /**
   * Handle the AI Tutor Pass side of a verified Stripe event. Returns true when the event is
   * fully handled (the caller stops); false lets the existing course handlers run (unchanged).
   * Disputes return false after revoking so the existing admin alert still goes out.
   * Runs whether or not the feature flag is on — refunds must always revoke.
   */
  static async handleStripeEvent(event: Stripe.Event): Promise<boolean> {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (!isAiPassObject(session)) return false;
        try {
          await AiTutorPassService.fulfilCheckoutSession(session, "webhook", event.id);
        } catch (error) {
          if (!(error instanceof PassFulfilmentError)) throw error;   // transient → 500 → Stripe retries
          log.error("AI Tutor Pass session rejected", { sessionId: session.id, reason: error.message });
        }
        return true;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        return isAiPassObject(event.data.object as Stripe.Checkout.Session);   // nothing to grant
      case "payment_intent.payment_failed":
        return isAiPassObject(event.data.object as Stripe.PaymentIntent);
      case "charge.refunded":
        return AiTutorPassService.handleRefund(event.data.object as Stripe.Charge);
      case "charge.dispute.created":
        await AiTutorPassService.handleDisputeCreated(event.data.object as Stripe.Dispute);
        return false;                                                       // keep the admin alert
      case "charge.dispute.closed":
        return AiTutorPassService.handleDisputeClosed(event.data.object as Stripe.Dispute);
      default:
        return false;
    }
  }

  // ─── Status ─────────────────────────────────────────────────────────────────

  static async status(studentId: string) {
    const now = new Date();
    const [current, queued, lastPass] = await Promise.all([
      AiTutorPassService.currentPass(studentId, now),
      AiTutorPassService.queuedPasses(studentId, now),
      db.select().from(aiTutorPasses).where(eq(aiTutorPasses.studentId, studentId))
        .orderBy(desc(aiTutorPasses.endsAt)).limit(1).then((r) => r[0] ?? null),
    ]);

    let usage: StudyMindPolicyStatus | null = null;
    let usageAvailable = true;
    if (current?.studymindPolicyCreatedAt) {
      try {
        usage = await getPolicyStatus(current.id, studentId);
      } catch (error) {
        usageAvailable = false;
        log.warn("StudyMind usage status unavailable", { passId: current.id, error });
      }
    }

    const view = (p: AiTutorPass) => ({ passId: p.id, startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString() });
    return {
      current: current ? view(current) : null,
      queued:  queued.map(view),
      // Most recent pass that is no longer usable — explains "expired" / "refunded" states
      last: !current && lastPass ? {
        ...view(lastPass),
        state: lastPass.revokedAt ? (lastPass.revokeReason ?? "revoked") : lastPass.endsAt <= now ? "expired" : "pending",
      } : null,
      canPurchaseMore: queued.length < AI_PASS.maxQueued,
      usage,
      usageAvailable,
    };
  }
}

