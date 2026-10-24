import type Stripe from "stripe";
import { db } from "@/db";
import {
  aiPassCheckouts, aiTutorPasses, courses, enrollments, purchases, users,
  type AiPassCheckout, type AiTutorPass,
} from "@/db/schema";
import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { AI_PASS, AI_PASS_METADATA, DAY_MS, aiPassPriceId } from "@/lib/ai-pass/config";
import { fairUseSummary, getPolicyStatus, revokePolicy, type StudyMindPolicyStatus } from "@/lib/ai-pass/studymind";
import { AI_PASS_TERMS } from "@/lib/ai-pass/terms";
import { log } from "@/lib/logger";
import { deliverEmail, PermanentEmailError } from "@/lib/email";

/**
 * A Checkout Session that cannot be processed as a pass right now and should not be retried by
 * Stripe: not a pass session, not paid yet (async payments complete later), or not attributable
 * to a Learnify student (alerted for manual reconciliation).
 */
export class PassFulfilmentError extends Error {
  constructor(message: string, readonly code: "not_pass" | "not_paid" | "unattributable") {
    super(message);
    this.name = "PassFulfilmentError";
  }
}

/** Consent the student gave when starting checkout (recorded server-side, then copied to the pass). */
export interface PurchaseConsent {
  termsVersion:    string;
  consentAt:       Date;
  /** Optional request for immediate access; only meaningful when the pass starts straight away. */
  immediateAccess: boolean;
}

export type RejectReason = "queue_full" | "refunded" | "disputed" | "invalid";
export type FulfilResult =
  | { outcome: "granted"; pass: AiTutorPass; created: boolean }
  | { outcome: "rejected"; reason: RejectReason; refundStatus: AiPassCheckout["refundStatus"] };

const VALID_PAYMENT = ["paid", "partially_refunded"] as const;
/** One active pass plus the queued ones. */
const MAX_HELD = 1 + AI_PASS.maxQueued;
const BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;
/** A claimed retry job is invisible to other workers for this long (StudyMind/Stripe calls time out well before). */
const CLAIM_LEASE_MS = 5 * 60 * 1000;
/** Retries keep going (capped at BACKOFF_MAX_MS) but administrators are alerted at this attempt. */
const ALERT_AT_ATTEMPT = 5;
/** A "sending" claim older than this is treated as a crashed delivery and retried (inside Brevo's 30-min dedupe window). */
const EMAIL_STALE_MS = 10 * 60 * 1000;
const EMAIL_MAX_ATTEMPTS = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reversal = "refunded" | "disputed";

async function lockStudent(tx: Tx, studentId: string) {
  // Serialises everything that decides a student's passes: checkout reservations, fulfilment,
  // refunds/disputes and revocation — so their order can never produce an active revoked payment
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"ai_pass:" + studentId}))`);
}

const isAiPassObject = (obj: { metadata?: Stripe.Metadata | null } | null | undefined) =>
  obj?.metadata?.app === AI_PASS_METADATA.app && obj?.metadata?.kind === AI_PASS_METADATA.kind;

const idOf = (ref: string | { id: string } | null | undefined) => (typeof ref === "string" ? ref : ref?.id ?? null);

const backoff = (attempts: number) => Math.min(60_000 * 2 ** Math.min(attempts, 10), BACKOFF_MAX_MS);

/** Passes that are active or queued (not revoked, not ended) — at most MAX_HELD. */
async function countHeld(tx: Tx, studentId: string, now: Date) {
  const [row] = await tx.select({ n: count() }).from(aiTutorPasses)
    .where(and(eq(aiTutorPasses.studentId, studentId), isNull(aiTutorPasses.revokedAt), gt(aiTutorPasses.endsAt, now)));
  return Number(row?.n ?? 0);
}

/** Log and (if ADMIN_EMAIL is set) email administrators. Never throws. */
async function alertOps(title: string, lines: string[]) {
  log.error(`AI Tutor Pass: ${title}`, { lines });
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;
    const { EmailService } = await import("@/services/email.service");
    await EmailService.aiPassOpsAlert(adminEmail, { title, lines });
  } catch (error) {
    log.warn("AI Tutor Pass ops alert email failed", { error });
  }
}

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

  // ─── Checkout (reservation) ─────────────────────────────────────────────────

  /**
   * Start a Checkout only if a slot is free: active/queued passes plus checkouts that may still be
   * paid stay within one active + two queued. The student's earlier open checkout (another tab) is
   * expired at Stripe first, so it can no longer be paid. Fulfilment re-checks the limit regardless.
   */
  static async startCheckout(
    studentId: string,
    consent: PurchaseConsent,
    create: (opts: { queued: boolean; immediateAccess: boolean }) => Promise<Stripe.Checkout.Session>,
  ): Promise<{ session: Stripe.Checkout.Session; queued: boolean } | { full: true }> {
    await AiTutorPassService.expireOpenCheckouts(studentId);

    return db.transaction(async (tx) => {
      await lockStudent(tx, studentId);
      const now = new Date();
      const held = await countHeld(tx, studentId, now);
      const [open] = await tx.select({ n: count() }).from(aiPassCheckouts)
        .where(and(eq(aiPassCheckouts.studentId, studentId), eq(aiPassCheckouts.status, "open"), gt(aiPassCheckouts.expiresAt, now)));
      if (held + Number(open?.n ?? 0) >= MAX_HELD) return { full: true as const };

      // A queued pass starts later, so a request for *immediate* access doesn't apply to it
      const queued = held > 0;
      const immediateAccess = consent.immediateAccess && !queued;
      const session = await create({ queued, immediateAccess });
      await tx.insert(aiPassCheckouts).values({
        stripeCheckoutSessionId: session.id,
        studentId,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : new Date(now.getTime() + 60 * 60_000),
        termsVersion: consent.termsVersion,
        consentAt: consent.consentAt,
        immediateAccessAck: immediateAccess,
      });
      return { session, queued };
    });
  }

  /** Expire the student's open, unpaid checkouts at Stripe. A session that was already paid is left open (awaiting fulfilment). */
  static async expireOpenCheckouts(studentId: string) {
    const open = await db.select().from(aiPassCheckouts)
      .where(and(eq(aiPassCheckouts.studentId, studentId), eq(aiPassCheckouts.status, "open"), gt(aiPassCheckouts.expiresAt, new Date())));
    for (const row of open) {
      let expired = false;
      try {
        await stripe.checkout.sessions.expire(row.stripeCheckoutSessionId);
        expired = true;
      } catch {
        // Already complete (paid) or already expired — ask Stripe which
        const s = await stripe.checkout.sessions.retrieve(row.stripeCheckoutSessionId).catch(() => null);
        expired = s?.status === "expired";
      }
      if (expired) await AiTutorPassService.markCheckoutExpired(row.stripeCheckoutSessionId);
    }
  }

  static async markCheckoutExpired(sessionId: string) {
    await db.update(aiPassCheckouts).set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(aiPassCheckouts.stripeCheckoutSessionId, sessionId), eq(aiPassCheckouts.status, "open")));
  }

  // ─── Fulfilment ─────────────────────────────────────────────────────────────

  /**
   * Turn a paid Checkout Session into a pass — or durably record why it can't be (and the refund
   * owed). Everything is re-read from Stripe; the webhook payload and the redirect are only hints.
   * Idempotent per session and serialised per student with refunds/disputes, so the order in which
   * Stripe events (or the success-page confirmation) arrive cannot grant a refunded payment.
   */
  static async fulfilCheckoutSession(sessionId: string, via: "webhook" | "confirm", eventId?: string): Promise<FulfilResult> {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!isAiPassObject(session)) throw new PassFulfilmentError("Not an AI Tutor Pass session", "not_pass");
    if (session.payment_status !== "paid") throw new PassFulfilmentError(`Payment not completed (${session.payment_status})`, "not_paid");

    // Who paid: our own checkout record first (written when the student started checkout)
    const [ledger] = await db.select().from(aiPassCheckouts).where(eq(aiPassCheckouts.stripeCheckoutSessionId, session.id)).limit(1);
    const studentId = ledger?.studentId ?? session.metadata?.student_id ?? "";
    const [student] = UUID_RE.test(studentId)
      ? await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, studentId)).limit(1)
      : [];
    if (!student) {
      await alertOps("Paid checkout with no Learnify student", [
        `Checkout Session ${session.id} (${session.amount_total} ${session.currency}) was paid but cannot be matched to a student.`,
        "Refund it in the Stripe dashboard or attach it to the right account.",
      ]);
      throw new PassFulfilmentError("Session cannot be attributed to a student", "unattributable");
    }

    // Validate the purchase (problem → recorded as "invalid" for manual review), then the live payment state
    const problem = (await AiTutorPassService.sessionProblem(session, student.id, student.role)) ?? null;
    const payment = problem ? { problem: null, reversal: null, refundedPence: 0 } : await AiTutorPassService.paymentState(session, student.id);
    const invalid = problem ?? payment.problem;
    const paymentIntentId = idOf(session.payment_intent);

    let fresh = false;
    const result = await db.transaction(async (tx): Promise<FulfilResult> => {
      await lockStudent(tx, student.id);
      const now = new Date();

      const [existing] = await tx.select().from(aiTutorPasses).where(eq(aiTutorPasses.stripeCheckoutSessionId, session.id)).limit(1);
      if (existing) return { outcome: "granted", pass: existing, created: false };

      await tx.insert(aiPassCheckouts).values({
        stripeCheckoutSessionId: session.id,
        studentId: student.id,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : now,
      }).onConflictDoNothing();
      const [row] = await tx.select().from(aiPassCheckouts).where(eq(aiPassCheckouts.stripeCheckoutSessionId, session.id)).limit(1);
      if (row.status === "rejected") {
        return { outcome: "rejected", reason: row.rejectReason as RejectReason, refundStatus: row.refundStatus };
      }

      const reason: RejectReason | null =
        invalid                ? "invalid" :
        payment.reversal       ? payment.reversal :
        (row.reversal as Reversal | null) ? (row.reversal as Reversal) :
        (await countHeld(tx, student.id, now)) >= MAX_HELD ? "queue_full" :
        null;

      if (reason) {
        fresh = true;
        const refundStatus = reason === "queue_full" ? "required" : reason === "invalid" ? "manual_review" : "not_required";
        await tx.update(aiPassCheckouts).set({
          status: "rejected", rejectReason: reason, rejectDetail: invalid,
          refundStatus, refundNextAttemptAt: refundStatus === "required" ? now : null,
          stripePaymentIntentId: paymentIntentId, amountPence: session.amount_total, updatedAt: now,
        }).where(eq(aiPassCheckouts.stripeCheckoutSessionId, session.id));
        return { outcome: "rejected", reason, refundStatus };
      }

      const [latest] = await tx
        .select({ endsAt: aiTutorPasses.endsAt })
        .from(aiTutorPasses)
        .where(and(eq(aiTutorPasses.studentId, student.id), isNull(aiTutorPasses.revokedAt), gt(aiTutorPasses.endsAt, now)))
        .orderBy(desc(aiTutorPasses.endsAt))
        .limit(1);
      const startsAt = latest ? latest.endsAt : now;
      const endsAt   = new Date(startsAt.getTime() + AI_PASS.durationDays * DAY_MS);
      const refundedPence = Math.max(payment.refundedPence, row.refundedAmountPence);
      // Consent: the server-side checkout record is authoritative; Stripe metadata is the fallback
      const metaConsent = session.metadata?.consent_at ? new Date(session.metadata.consent_at) : null;
      const consentAt = row.consentAt ?? (metaConsent && !isNaN(metaConsent.getTime()) ? metaConsent : null);
      const termsVersion = row.termsVersion ?? session.metadata?.terms_version ?? null;
      const immediateAccessAck = row.termsVersion ? row.immediateAccessAck : session.metadata?.immediate_access === "true";

      const [pass] = await tx.insert(aiTutorPasses).values({
        studentId: student.id,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:   paymentIntentId,
        stripePriceId:           aiPassPriceId()!,
        stripeEventId:           eventId ?? null,
        fulfilledVia:            via,
        amountPence:             session.amount_total!,
        currency:                session.currency!,
        consentAt,
        termsVersion,
        immediateAccessAck,
        purchasedAt:             now,
        startsAt,
        endsAt,
        paymentStatus:           refundedPence > 0 ? "partially_refunded" : "paid",
        // Confirmation email outbox — committed with the pass, so the email can't be forgotten
        confirmationEmailStatus:        "pending",
        confirmationEmailNextAttemptAt: now,
        refundedAmountPence:     refundedPence,
      }).returning();
      await tx.update(aiPassCheckouts).set({
        status: "fulfilled", passId: pass.id, stripePaymentIntentId: paymentIntentId, amountPence: session.amount_total, updatedAt: now,
      }).where(eq(aiPassCheckouts.stripeCheckoutSessionId, session.id));

      log.info("AI Tutor Pass granted", { passId: pass.id, studentId: student.id, via, startsAt, endsAt });
      return { outcome: "granted", pass, created: true };
    });

    // One confirmation email per granted pass, whichever delivery (webhook or confirm) gets here first
    if (result.outcome === "granted") {
      await AiTutorPassService.processPendingConfirmationEmails({ passId: result.pass.id })
        .catch((error) => log.error("AI Tutor Pass confirmation email processing failed", { passId: result.pass.id, error }));
    }

    if (result.outcome === "rejected" && fresh) {
      log.warn("AI Tutor Pass payment not granted", { sessionId: session.id, reason: result.reason, detail: invalid });
      if (result.refundStatus === "required") await AiTutorPassService.processPendingRefunds({ sessionId: session.id });
      if (result.refundStatus === "manual_review") {
        await alertOps("Paid checkout needs review", [
          `Checkout Session ${session.id} was paid but failed validation: ${invalid}.`,
          "No pass was granted. Review it in Stripe and refund if appropriate.",
        ]);
      }
    }
    return result;
  }

  /** What's wrong with this paid session as a pass purchase, or null. Throws (→ retry) on config/transient errors. */
  private static async sessionProblem(session: Stripe.Checkout.Session, studentId: string, role: string): Promise<string | null> {
    const priceId = aiPassPriceId();
    if (!priceId) throw new Error("STRIPE_AI_PASS_PRICE_ID is not configured");   // never reject a real payment for our config
    if (session.mode !== "payment") return "Not a one-time payment";
    if (session.currency !== AI_PASS.currency || session.amount_total !== AI_PASS.pricePence) {
      return `Unexpected amount ${session.amount_total} ${session.currency}`;
    }
    if (session.metadata?.student_id !== studentId || session.client_reference_id !== studentId) return "Session owner mismatch";
    if (role !== "student") return "Purchaser is not a student";

    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
    const [item] = items.data;
    if (items.data.length !== 1 || item.quantity !== 1 || item.price?.id !== priceId
        || item.amount_total !== AI_PASS.pricePence || item.currency !== AI_PASS.currency) {
      return "Line items do not match the AI Tutor Pass price";
    }
    return null;
  }

  /** The PaymentIntent's live state at Stripe: succeeded, our amount/owner, and whether it was refunded or disputed. */
  private static async paymentState(session: Stripe.Checkout.Session, studentId: string):
      Promise<{ problem: string | null; reversal: Reversal | null; refundedPence: number }> {
    const piId = idOf(session.payment_intent);
    if (!piId) return { problem: "No payment intent", reversal: null, refundedPence: 0 };
    const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    if (pi.status !== "succeeded") throw new PassFulfilmentError(`Payment intent ${pi.status}`, "not_paid");
    if (pi.amount !== AI_PASS.pricePence || pi.currency !== AI_PASS.currency) {
      return { problem: `Unexpected payment amount ${pi.amount} ${pi.currency}`, reversal: null, refundedPence: 0 };
    }
    if (!isAiPassObject(pi) || pi.metadata.student_id !== studentId) {
      return { problem: "Payment intent owner mismatch", reversal: null, refundedPence: 0 };
    }
    const charge = typeof pi.latest_charge === "object" && pi.latest_charge
      ? pi.latest_charge
      : pi.latest_charge ? await stripe.charges.retrieve(pi.latest_charge) : null;
    if (!charge) throw new Error(`Payment intent ${pi.id} has no charge yet`);
    const refundedPence = charge.amount_refunded ?? 0;
    const reversal: Reversal | null =
      charge.disputed ? "disputed" : charge.refunded || refundedPence >= pi.amount ? "refunded" : null;
    return { problem: null, reversal, refundedPence };
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
      const [{ studentId } = { studentId: null }] = await tx.select({ studentId: aiTutorPasses.studentId })
        .from(aiTutorPasses).where(eq(aiTutorPasses.id, passId)).limit(1);
      if (!studentId) return;
      await lockStudent(tx, studentId);
      const [pass] = await tx.select().from(aiTutorPasses).where(eq(aiTutorPasses.id, passId)).limit(1);
      const now = new Date();
      await tx.update(aiTutorPasses).set({
        ...fields,
        revokedAt:    pass.revokedAt ?? now,
        revokeReason: pass.revokeReason ?? reason,
        ...(pass.studymindRevokeStatus === "done" ? {} : {
          studymindRevokeStatus: "pending" as const, studymindRevokeNextAttemptAt: now,
        }),
        // Not yet delivered → don't send a confirmation for a revoked pass
        ...(pass.confirmationEmailStatus === "pending" ? { confirmationEmailStatus: "skipped" as const, confirmationEmailLastError: `pass ${reason}` } : {}),
        updatedAt: now,
      }).where(eq(aiTutorPasses.id, passId));
      await AiTutorPassService.rechainQueued(tx, studentId, now);
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

  /** charge.refunded — full refund revokes (or blocks a not-yet-granted pass); partial refund is recorded only. */
  static async handleRefund(charge: Stripe.Charge): Promise<boolean> {
    const refunded = charge.amount_refunded ?? 0;
    const full = charge.refunded || refunded >= charge.amount;
    return AiTutorPassService.applyReversal(idOf(charge.payment_intent), full ? "refunded" : null, { refundedPence: refunded });
  }

  /** charge.dispute.created — revoke at once, or block a not-yet-granted pass (won disputes stay revoked). */
  static async handleDisputeCreated(dispute: Stripe.Dispute): Promise<boolean> {
    return AiTutorPassService.applyReversal(idOf(dispute.payment_intent), "disputed", { disputeId: dispute.id, disputeStatus: dispute.status });
  }

  /** charge.dispute.closed — record the outcome only; access stays revoked. */
  static async handleDisputeClosed(dispute: Stripe.Dispute): Promise<boolean> {
    const piId = idOf(dispute.payment_intent);
    if (!piId) return false;
    const now = new Date();
    const passes = await db.update(aiTutorPasses).set({ disputeStatus: dispute.status, updatedAt: now })
      .where(eq(aiTutorPasses.stripePaymentIntentId, piId)).returning({ id: aiTutorPasses.id });
    const checkouts = await db.update(aiPassCheckouts).set({ disputeStatus: dispute.status, updatedAt: now })
      .where(eq(aiPassCheckouts.stripePaymentIntentId, piId)).returning({ id: aiPassCheckouts.stripeCheckoutSessionId });
    return passes.length + checkouts.length > 0;
  }

  /**
   * Apply a refund/dispute to whatever exists for this payment: the pass (revoke), its checkout
   * record, or — when it arrives before fulfilment — a reversal on the checkout record that blocks
   * the pass from ever being granted. Returns false for payments that aren't AI Tutor Passes.
   */
  private static async applyReversal(
    piId: string | null, kind: Reversal | null,
    info: { refundedPence?: number; disputeId?: string; disputeStatus?: string },
  ): Promise<boolean> {
    if (!piId) return false;

    const pass = await AiTutorPassService.findByPaymentIntent(piId);
    if (pass) {
      await AiTutorPassService.applyToPass(pass, kind, info);
      return true;
    }

    const [checkout] = await db.select().from(aiPassCheckouts).where(eq(aiPassCheckouts.stripePaymentIntentId, piId)).limit(1);
    let target: { studentId: string; sessionId: string; expiresAt: Date } | null =
      checkout ? { studentId: checkout.studentId, sessionId: checkout.stripeCheckoutSessionId, expiresAt: checkout.expiresAt } : null;

    if (!target) {
      // Course purchases are never ours (keeps course refunds/disputes on their existing path)
      const [course] = await db.select({ id: purchases.id }).from(purchases).where(eq(purchases.stripePaymentIntentId, piId)).limit(1);
      if (course) return false;
      const pi = await stripe.paymentIntents.retrieve(piId);
      if (!isAiPassObject(pi)) return false;
      const sessions = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
      const session = sessions.data[0];
      const studentId = pi.metadata.student_id ?? "";
      const [student] = UUID_RE.test(studentId)
        ? await db.select({ id: users.id }).from(users).where(eq(users.id, studentId)).limit(1)
        : [];
      if (!session || !student) {
        await alertOps(`${kind ?? "Refund"} on an unmatched AI Tutor Pass payment`, [`Payment ${piId} could not be matched to a checkout or student.`]);
        return true;
      }
      target = {
        studentId: student.id, sessionId: session.id,
        expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : new Date(),
      };
    }

    // Under the student's lock: either the pass already exists (revoke it) or we leave a reversal
    // that fulfilment will see — there is no ordering in which a refunded payment ends up active
    const { studentId, sessionId, expiresAt } = target;
    const grantedMeanwhile = await db.transaction(async (tx) => {
      await lockStudent(tx, studentId);
      const [p] = await tx.select().from(aiTutorPasses).where(eq(aiTutorPasses.stripeCheckoutSessionId, sessionId)).limit(1);
      if (p) return p;
      const now = new Date();
      await tx.insert(aiPassCheckouts).values({ stripeCheckoutSessionId: sessionId, studentId, expiresAt }).onConflictDoNothing();
      await tx.update(aiPassCheckouts).set({
        stripePaymentIntentId: sql`coalesce(${aiPassCheckouts.stripePaymentIntentId}, ${piId})`,
        refundedAmountPence:   sql`greatest(${aiPassCheckouts.refundedAmountPence}, ${info.refundedPence ?? 0})`,
        ...(kind ? {
          reversal:   sql`coalesce(${aiPassCheckouts.reversal}, ${kind})`,
          reversedAt: sql`coalesce(${aiPassCheckouts.reversedAt}, now())`,
        } : {}),
        ...(info.disputeStatus ? { disputeStatus: info.disputeStatus } : {}),
        // Our automatic (or an admin's manual) refund of a rejected payment has gone through
        ...(kind === "refunded" ? {
          refundStatus: sql`case when ${aiPassCheckouts.refundStatus} in ('required', 'manual_review') then 'refunded'::ai_pass_refund_status else ${aiPassCheckouts.refundStatus} end`,
        } : {}),
        updatedAt: now,
      }).where(eq(aiPassCheckouts.stripeCheckoutSessionId, sessionId));
      return null;
    });
    if (grantedMeanwhile) await AiTutorPassService.applyToPass(grantedMeanwhile, kind, info);
    else log.warn("AI Tutor Pass payment reversed before fulfilment", { sessionId, kind });
    return true;
  }

  private static async applyToPass(pass: AiTutorPass, kind: Reversal | null, info: { refundedPence?: number; disputeId?: string; disputeStatus?: string }) {
    const refunded = sql`greatest(${aiTutorPasses.refundedAmountPence}, ${info.refundedPence ?? 0})`;
    if (kind === "refunded") {
      await AiTutorPassService.revoke(pass.id, "refunded", { paymentStatus: "refunded", refundedAmountPence: refunded as never });
      log.info("AI Tutor Pass revoked after full refund", { passId: pass.id });
    } else if (kind === "disputed") {
      await AiTutorPassService.revoke(pass.id, "disputed", { paymentStatus: "disputed", disputeId: info.disputeId, disputeStatus: info.disputeStatus });
      log.warn("AI Tutor Pass revoked after dispute", { passId: pass.id, disputeId: info.disputeId });
    } else {
      await db.update(aiTutorPasses).set({
        refundedAmountPence: refunded,
        // never downgrade a revoked/disputed pass back to a usable status
        paymentStatus: sql`case when ${aiTutorPasses.revokedAt} is null then 'partially_refunded'::ai_pass_payment_status else ${aiTutorPasses.paymentStatus} end`,
        updatedAt: new Date(),
      }).where(eq(aiTutorPasses.id, pass.id));
      log.warn("AI Tutor Pass partially refunded — access kept", { passId: pass.id, refunded: info.refundedPence });
    }
  }

  /**
   * Retry queued StudyMind revocations. Jobs are claimed with FOR UPDATE SKIP LOCKED plus a lease,
   * so concurrent workers never process the same pass; the status only ever moves pending → done
   * (on a 2xx or StudyMind's "no policy"), and a failure never touches the Learnify revocation.
   */
  static async processPendingRevocations(opts: { passId?: string; limit?: number } = {}) {
    const claimed = await db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx.select().from(aiTutorPasses)
        .where(and(
          eq(aiTutorPasses.studymindRevokeStatus, "pending"),
          lte(aiTutorPasses.studymindRevokeNextAttemptAt, now),
          opts.passId ? eq(aiTutorPasses.id, opts.passId) : undefined,
        ))
        .orderBy(asc(aiTutorPasses.studymindRevokeNextAttemptAt))
        .limit(opts.limit ?? 25)
        .for("update", { skipLocked: true });
      if (rows.length) {
        await tx.update(aiTutorPasses).set({ studymindRevokeNextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS) })
          .where(inArray(aiTutorPasses.id, rows.map((r) => r.id)));
      }
      return rows;
    });

    let done = 0, failed = 0;
    for (const pass of claimed) {
      try {
        const outcome = await revokePolicy(pass.id, pass.studentId, pass.revokeReason ?? "revoked");
        await db.update(aiTutorPasses).set({
          studymindRevokeStatus: "done", studymindRevokedAt: new Date(), studymindRevokeLastError: null,
          studymindRevokeNextAttemptAt: null, updatedAt: new Date(),
        }).where(and(eq(aiTutorPasses.id, pass.id), eq(aiTutorPasses.studymindRevokeStatus, "pending")));
        log.info("StudyMind policy revocation complete", { passId: pass.id, outcome });
        done++;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : String(error);
        const [row] = await db.update(aiTutorPasses).set({
          studymindRevokeAttempts:      sql`${aiTutorPasses.studymindRevokeAttempts} + 1`,
          studymindRevokeLastError:     message,
          studymindRevokeNextAttemptAt: new Date(Date.now() + backoff(pass.studymindRevokeAttempts + 1)),
          updatedAt:                    new Date(),
        }).where(and(eq(aiTutorPasses.id, pass.id), eq(aiTutorPasses.studymindRevokeStatus, "pending")))
          .returning({ attempts: aiTutorPasses.studymindRevokeAttempts });
        log.error("StudyMind policy revocation failed — will retry", { passId: pass.id, attempts: row?.attempts, error: message });
        if (row?.attempts === ALERT_AT_ATTEMPT) {
          await alertOps("StudyMind revocation keeps failing", [
            `Pass ${pass.id} is revoked in Learnify (no new tokens), but StudyMind has refused revocation ${row.attempts} times: ${message}.`,
            "Tokens already issued for this pass stay valid until they expire (at most 1 hour). Retries continue every 6 hours at most.",
          ]);
        }
        failed++;
      }
    }
    return { due: claimed.length, done, failed };
  }

  /**
   * Issue refunds owed for rejected payments (pass limit reached). Claimed like revocations; the
   * Stripe idempotency key — and Stripe refusing to refund more than was paid — make retries safe.
   */
  static async processPendingRefunds(opts: { sessionId?: string; limit?: number } = {}) {
    const claimed = await db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx.select().from(aiPassCheckouts)
        .where(and(
          eq(aiPassCheckouts.refundStatus, "required"),
          lte(aiPassCheckouts.refundNextAttemptAt, now),
          opts.sessionId ? eq(aiPassCheckouts.stripeCheckoutSessionId, opts.sessionId) : undefined,
        ))
        .orderBy(asc(aiPassCheckouts.refundNextAttemptAt))
        .limit(opts.limit ?? 25)
        .for("update", { skipLocked: true });
      if (rows.length) {
        await tx.update(aiPassCheckouts).set({ refundNextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS) })
          .where(inArray(aiPassCheckouts.stripeCheckoutSessionId, rows.map((r) => r.stripeCheckoutSessionId)));
      }
      return rows;
    });

    let done = 0, failed = 0;
    for (const row of claimed) {
      const id = row.stripeCheckoutSessionId;
      try {
        if (!row.stripePaymentIntentId) throw new Error("No payment intent recorded");
        let refundId: string | null = null;
        try {
          const refund = await stripe.refunds.create(
            { payment_intent: row.stripePaymentIntentId, reason: "requested_by_customer", metadata: { ...AI_PASS_METADATA, checkout_session_id: id } },
            { idempotencyKey: `ai-pass-refund-${id}` },
          );
          refundId = refund.id;
        } catch (error) {
          // Already refunded (e.g. by an admin) — nothing left to do
          if ((error as { code?: string })?.code !== "charge_already_refunded") throw error;
        }
        await db.update(aiPassCheckouts).set({
          refundStatus: "refunded", stripeRefundId: refundId, refundLastError: null, refundNextAttemptAt: null, updatedAt: new Date(),
        }).where(and(eq(aiPassCheckouts.stripeCheckoutSessionId, id), eq(aiPassCheckouts.refundStatus, "required")));
        log.info("AI Tutor Pass rejected payment refunded", { sessionId: id, refundId });
        done++;
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : String(error);
        const [updated] = await db.update(aiPassCheckouts).set({
          refundAttempts:      sql`${aiPassCheckouts.refundAttempts} + 1`,
          refundLastError:     message,
          refundNextAttemptAt: new Date(Date.now() + backoff(row.refundAttempts + 1)),
          updatedAt:           new Date(),
        }).where(and(eq(aiPassCheckouts.stripeCheckoutSessionId, id), eq(aiPassCheckouts.refundStatus, "required")))
          .returning({ attempts: aiPassCheckouts.refundAttempts });
        log.error("AI Tutor Pass refund failed — will retry", { sessionId: id, attempts: updated?.attempts, error: message });
        if (updated?.attempts === ALERT_AT_ATTEMPT) {
          await alertOps("Refund for a rejected payment keeps failing", [
            `Checkout Session ${id} was paid after the student reached the pass limit. The automatic refund has failed ${updated.attempts} times: ${message}.`,
            "Refund it in the Stripe dashboard.",
          ]);
        }
        failed++;
      }
    }
    return { due: claimed.length, done, failed };
  }

  /**
   * After StudyMind issued a pass token: record that a policy now exists, and confirm the pass is
   * still valid. If it was revoked while the token was being minted (a refund racing the request),
   * the revocation is re-queued so StudyMind revokes the policy just created — and the caller must
   * not hand out the token. Returns false in that case.
   */
  static async confirmPolicyIssued(passId: string): Promise<boolean> {
    const now = new Date();
    const [pass] = await db.update(aiTutorPasses).set({
      studymindPolicyCreatedAt: sql`coalesce(${aiTutorPasses.studymindPolicyCreatedAt}, now())`,
      updatedAt: now,
    }).where(eq(aiTutorPasses.id, passId)).returning();
    if (!pass) return false;
    if (!pass.revokedAt) return true;

    await db.update(aiTutorPasses).set({
      studymindRevokeStatus: "pending", studymindRevokeNextAttemptAt: now, studymindRevokedAt: null, updatedAt: now,
    }).where(eq(aiTutorPasses.id, passId));
    await AiTutorPassService.processPendingRevocations({ passId });
    return false;
  }

  // ─── Confirmation email ─────────────────────────────────────────────────────

  /**
   * Deliver pending purchase confirmations (an outbox on the pass row). Jobs are claimed with
   * FOR UPDATE SKIP LOCKED, so duplicate webhooks, concurrent confirmations and cron runs never
   * deliver the same email at the same time. The pass id is sent as the provider idempotency key,
   * so a retry within the provider's dedupe window (30 min per Brevo) isn't delivered twice.
   * A claim left in "sending" (process crashed mid-delivery) is reclaimed after EMAIL_STALE_MS —
   * inside that window, so a resend is deduplicated by the provider.
   *
   * Not exactly-once: if a delivery was accepted by the provider but the outcome was lost, and the
   * retry happens after the provider's dedupe window, the student can receive a second copy.
   */
  static async processPendingConfirmationEmails(opts: { passId?: string; limit?: number } = {}) {
    const now = new Date();
    const claimed = await db.transaction(async (tx) => {
      const rows = await tx.select().from(aiTutorPasses)
        .where(and(
          opts.passId ? eq(aiTutorPasses.id, opts.passId) : undefined,
          or(
            and(eq(aiTutorPasses.confirmationEmailStatus, "pending"), lte(aiTutorPasses.confirmationEmailNextAttemptAt, now)),
            and(eq(aiTutorPasses.confirmationEmailStatus, "sending"), lte(aiTutorPasses.confirmationEmailClaimedAt, new Date(now.getTime() - EMAIL_STALE_MS))),
          ),
        ))
        .orderBy(asc(aiTutorPasses.confirmationEmailNextAttemptAt))
        .limit(opts.limit ?? 25)
        .for("update", { skipLocked: true });
      if (rows.length) {
        await tx.update(aiTutorPasses).set({
          confirmationEmailStatus: "sending", confirmationEmailClaimedAt: now,
          confirmationEmailAttempts: sql`${aiTutorPasses.confirmationEmailAttempts} + 1`,
        }).where(inArray(aiTutorPasses.id, rows.map((r) => r.id)));
      }
      return rows;
    });

    let sent = 0, failed = 0, retrying = 0, skipped = 0;
    for (const pass of claimed) {
      const attempt = pass.confirmationEmailAttempts + 1;
      const finish = (fields: Partial<typeof aiTutorPasses.$inferInsert>) =>
        db.update(aiTutorPasses).set({ ...fields, updatedAt: new Date() })
          .where(and(eq(aiTutorPasses.id, pass.id), eq(aiTutorPasses.confirmationEmailStatus, "sending")));

      if (pass.revokedAt) {
        await finish({ confirmationEmailStatus: "skipped", confirmationEmailLastError: `pass ${pass.revokeReason ?? "revoked"}` });
        skipped++;
        continue;
      }
      try {
        const [student] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, pass.studentId)).limit(1);
        if (!student?.email) throw new PermanentEmailError("Student has no email address");
        const { EmailService } = await import("@/services/email.service");
        const { subject, html } = EmailService.buildAiTutorPassConfirmation({
          studentName:        student.name ?? "there",
          amountPence:        pass.amountPence,
          currency:           pass.currency,
          purchasedAt:        pass.purchasedAt,
          startsAt:           pass.startsAt,
          endsAt:             pass.endsAt,
          // Queued: bought while another pass was active, so it starts later
          queued:             pass.startsAt.getTime() - pass.purchasedAt.getTime() > 60_000,
          immediateAccessAck: pass.immediateAccessAck,
          consentAt:          pass.consentAt,
          termsVersion:       pass.termsVersion ?? AI_PASS_TERMS.version,
          reference:          pass.id.slice(0, 8).toUpperCase(),
        });
        const outcome = await deliverEmail(student.email, subject, html, { idempotencyKey: pass.id });
        if (outcome.status === "skipped") {
          await finish({ confirmationEmailStatus: "skipped", confirmationEmailLastError: outcome.reason });
          skipped++;
        } else {
          await finish({
            confirmationEmailStatus: "sent", confirmationEmailSentAt: new Date(), confirmationEmailLastError: null,
            confirmationEmailMessageId: outcome.status === "sent" ? outcome.messageId ?? null : "duplicate-accepted",
            confirmationEmailNextAttemptAt: null,
          });
          log.info("AI Tutor Pass confirmation email delivered", { passId: pass.id, outcome: outcome.status });
          sent++;
        }
      } catch (error) {
        const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
        const permanent = error instanceof PermanentEmailError || attempt >= EMAIL_MAX_ATTEMPTS;
        await finish(permanent
          ? { confirmationEmailStatus: "failed", confirmationEmailLastError: message, confirmationEmailNextAttemptAt: null }
          : { confirmationEmailStatus: "pending", confirmationEmailLastError: message, confirmationEmailNextAttemptAt: new Date(Date.now() + backoff(attempt)) });
        log.error("AI Tutor Pass confirmation email failed", { passId: pass.id, attempt, permanent, error: message });
        if (permanent) {
          failed++;
          await alertOps("Purchase confirmation email could not be delivered", [
            `Pass ${pass.id} (student ${pass.studentId}) is active, but its confirmation email failed after ${attempt} attempt(s): ${message}.`,
            "The pass itself is unaffected. Contact the student, or fix the address and set confirmation_email_status back to 'pending'.",
          ]);
        } else retrying++;
      }
    }
    return { due: claimed.length, sent, retrying, failed, skipped };
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
          await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook", event.id);
        } catch (error) {
          if (!(error instanceof PassFulfilmentError)) throw error;   // transient → 500 → Stripe retries
          log.warn("AI Tutor Pass session not fulfilled", { sessionId: session.id, code: error.code, reason: error.message });
        }
        return true;
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (!isAiPassObject(session)) return false;
        await AiTutorPassService.markCheckoutExpired(session.id);   // frees the reserved slot
        return true;
      }
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
    const [current, queued, lastPass, rejected] = await Promise.all([
      AiTutorPassService.currentPass(studentId, now),
      AiTutorPassService.queuedPasses(studentId, now),
      // The pass that most recently stopped being usable (revoked, or ended) — a refunded pass's
      // original end date is in the future, so order by when it actually stopped
      db.select().from(aiTutorPasses)
        .where(and(eq(aiTutorPasses.studentId, studentId),
                   or(sql`${aiTutorPasses.revokedAt} is not null`, lte(aiTutorPasses.endsAt, now))))
        .orderBy(desc(sql`coalesce(${aiTutorPasses.revokedAt}, ${aiTutorPasses.endsAt})`)).limit(1).then((r) => r[0] ?? null),
      // Payments in the last 30 days that couldn't become a pass (and what happens to the money)
      db.select().from(aiPassCheckouts)
        .where(and(eq(aiPassCheckouts.studentId, studentId), eq(aiPassCheckouts.status, "rejected"),
                   gte(aiPassCheckouts.updatedAt, new Date(now.getTime() - 30 * DAY_MS))))
        .orderBy(desc(aiPassCheckouts.updatedAt)).limit(5),
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
      canPurchaseMore: (current ? 1 : 0) + queued.length < MAX_HELD && queued.length < AI_PASS.maxQueued,
      rejectedPayments: rejected.map((r) => ({
        at: r.updatedAt.toISOString(), reason: r.rejectReason, refundStatus: r.refundStatus,
      })),
      // Daily allowances for the browser — without the internal dollar budget
      usage: usage ? { ...usage, budget: undefined } : null,
      // Pass-level fair-use budget as a rounded percentage (separate from daily allowances; never resets)
      fairUse: fairUseSummary(usage),
      usageAvailable,
    };
  }

  /** Administrators: payments and revocations that need attention. */
  static async adminIssues() {
    const [revocations, payments] = await Promise.all([
      db.select({
        passId: aiTutorPasses.id, studentId: aiTutorPasses.studentId, revokedAt: aiTutorPasses.revokedAt,
        reason: aiTutorPasses.revokeReason, attempts: aiTutorPasses.studymindRevokeAttempts,
        lastError: aiTutorPasses.studymindRevokeLastError, nextAttemptAt: aiTutorPasses.studymindRevokeNextAttemptAt,
      }).from(aiTutorPasses)
        .where(and(eq(aiTutorPasses.studymindRevokeStatus, "pending"), gt(aiTutorPasses.studymindRevokeAttempts, 0)))
        .orderBy(desc(aiTutorPasses.studymindRevokeAttempts)).limit(100),
      db.select({
        checkoutSessionId: aiPassCheckouts.stripeCheckoutSessionId, studentId: aiPassCheckouts.studentId,
        paymentIntentId: aiPassCheckouts.stripePaymentIntentId, reason: aiPassCheckouts.rejectReason,
        detail: aiPassCheckouts.rejectDetail, refundStatus: aiPassCheckouts.refundStatus,
        attempts: aiPassCheckouts.refundAttempts, lastError: aiPassCheckouts.refundLastError, updatedAt: aiPassCheckouts.updatedAt,
      }).from(aiPassCheckouts)
        .where(or(eq(aiPassCheckouts.refundStatus, "manual_review"),
                  and(eq(aiPassCheckouts.refundStatus, "required"), gt(aiPassCheckouts.refundAttempts, 0))))
        .orderBy(desc(aiPassCheckouts.updatedAt)).limit(100),
    ]);
    const emails = await db.select({
      passId: aiTutorPasses.id, studentId: aiTutorPasses.studentId, status: aiTutorPasses.confirmationEmailStatus,
      attempts: aiTutorPasses.confirmationEmailAttempts, lastError: aiTutorPasses.confirmationEmailLastError,
      nextAttemptAt: aiTutorPasses.confirmationEmailNextAttemptAt,
    }).from(aiTutorPasses)
      .where(or(eq(aiTutorPasses.confirmationEmailStatus, "failed"),
                and(eq(aiTutorPasses.confirmationEmailStatus, "pending"), gt(aiTutorPasses.confirmationEmailAttempts, 0))))
      .orderBy(desc(aiTutorPasses.updatedAt)).limit(100);
    return { failingRevocations: revocations, paymentsNeedingAttention: payments, confirmationEmails: emails };
  }
}
