import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { purchases, enrollments, courses, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { constructWebhookEvent } from "@/lib/stripe";
import { log } from "@/lib/logger";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET === "whsec_placeholder") {
    if (process.env.NODE_ENV === "production") {
      log.error("STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook in production");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }
    log.warn("Stripe webhook secret not configured — skipping verification in dev");
    return NextResponse.json({ received: true });
  }

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    log.error("Webhook signature verification failed", { err });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  log.info("Stripe webhook received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event);
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(event);
        break;
      case "checkout.session.async_payment_succeeded":
        await handleAsyncPaymentSucceeded(event);
        break;
      case "checkout.session.async_payment_failed":
        await handleAsyncPaymentFailed(event);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event);
        break;
      case "charge.dispute.created":
        await handleDisputeCreated(event);
        break;
      case "payout.failed":
        await handleTransferFailed(event);
        break;
      case "account.updated":
        await handleAccountUpdated(event);
        break;
      default:
        log.debug("Unhandled webhook event", { type: event.type });
    }
  } catch (error) {
    log.error("Webhook handler error", { type: event.type, error });
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  // Idempotency guard
  const [existingByEvent] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(eq(purchases.stripeEventId, event.id))
    .limit(1);

  if (existingByEvent) {
    log.info("Webhook already processed, skipping", { eventId: event.id });
    return;
  }

  const courseId  = session.metadata?.courseId;
  const studentId = session.metadata?.studentId;
  const sessionId = session.metadata?.sessionId ?? null;

  if (!courseId || !studentId) {
    log.error("Missing metadata in checkout session", { sessionId: session.id });
    return;
  }

  const [purchase] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.stripeSessionId, session.id))
    .limit(1);

  if (!purchase) {
    log.error("Purchase record not found for session", { sessionId: session.id });
    return;
  }

  const [updatedPurchase] = await db
    .update(purchases)
    .set({
      status:                "completed",
      stripePaymentIntentId: session.payment_intent as string,
      stripeEventId:         event.id,
      updatedAt:             new Date(),
    })
    .where(eq(purchases.id, purchase.id))
    .returning();

  // Grant course access
  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
    .limit(1);

  if (!existing) {
    await db.insert(enrollments).values({
      studentId,
      courseId,
      purchaseId: purchase.id,
      sessionId:  sessionId ?? null,
      progress:   0,
    });

    await db
      .update(courses)
      .set({ enrollmentCount: sql`${courses.enrollmentCount} + 1` })
      .where(eq(courses.id, courseId));

    // Reserve session seat
    if (sessionId) {
      try {
        const { SessionService } = await import("@/services/session.service");
        await SessionService.reserveSeat(sessionId);
      } catch (seatErr) {
        log.warn("Seat reservation failed after payment", { sessionId, seatErr });
      }
    }
  }

  log.info("Checkout completed — enrollment granted", {
    purchaseId: updatedPurchase.id,
    courseId,
    studentId,
  });

  // Purchase confirmation email
  try {
    const { EmailService } = await import("@/services/email.service");
    const [[studentRow], [courseRow]] = await Promise.all([
      db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, studentId)).limit(1),
      db.select({ title: courses.title, format: courses.format }).from(courses).where(eq(courses.id, courseId)).limit(1),
    ]);

    // sessionId here is the *course* session (Stripe metadata, read above) —
    // not the Stripe checkout `session` object this handler is named after.
    let sessionDetails = null;
    if (sessionId) {
      const { courseSessions } = await import("@/db/schema");
      const [sess] = await db
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.id, sessionId))
        .limit(1);
      sessionDetails = sess ?? null;
    }

    if (studentRow?.email && courseRow) {
      await EmailService.purchaseConfirmation(studentRow.email, {
        studentName:  studentRow.name ?? "Student",
        courseTitle:  courseRow.title,
        courseSlug:   courseId,
        amount:       `£${Number(session.amount_total ? session.amount_total / 100 : 0).toFixed(2)}`,
        courseFormat: courseRow.format,
        // Session details
        sessionTitle: sessionDetails?.title ?? undefined,
        sessionDate:  sessionDetails?.startDatetime
          ? new Date(sessionDetails.startDatetime).toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })
          : undefined,
        sessionTime: sessionDetails?.startDatetime && sessionDetails?.endDatetime
          ? `${new Date(sessionDetails.startDatetime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} – ${new Date(sessionDetails.endDatetime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
          : undefined,
        venueAddress:       sessionDetails?.venueAddress       ?? undefined,
        venueCity:          sessionDetails?.venueCity          ?? undefined,
        venuePostcode:      sessionDetails?.venuePostcode      ?? undefined,
        venueMapUrl:        sessionDetails?.venueMapUrl        ?? undefined,
        conferencePlatform: sessionDetails?.conferencePlatform ?? undefined,
        conferenceUrl:      sessionDetails?.conferenceUrl      ?? undefined,
        conferencePassword: sessionDetails?.conferencePassword ?? undefined,
      });
    }
  } catch (emailErr) {
    log.warn("Purchase confirmation email failed", { emailErr });
  }
}

async function handleCheckoutExpired(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  await db
    .update(purchases)
    .set({ status: "failed", stripeEventId: event.id, updatedAt: new Date() })
    .where(and(eq(purchases.stripeSessionId, session.id), eq(purchases.status, "pending")));

  log.info("Checkout session expired — purchase marked failed", { sessionId: session.id });
}

async function handleAsyncPaymentSucceeded(event: Stripe.Event) {
  await handleCheckoutCompleted(event);
}

async function handleAsyncPaymentFailed(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  await db
    .update(purchases)
    .set({ status: "failed", stripeEventId: event.id, updatedAt: new Date() })
    .where(eq(purchases.stripeSessionId, session.id));

  log.warn("Async payment failed", { sessionId: session.id });

  // Notify student their payment failed
  try {
    const studentId = session.metadata?.studentId;
    const courseId  = session.metadata?.courseId;
    if (studentId && courseId) {
      const { EmailService } = await import("@/services/email.service");
      const [[studentRow], [courseRow]] = await Promise.all([
        db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, studentId)).limit(1),
        db.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId)).limit(1),
      ]);
      if (studentRow?.email && courseRow) {
        await EmailService.paymentFailed(studentRow.email, {
          studentName: studentRow.name ?? "Student",
          courseTitle: courseRow.title,
        });
      }
    }
  } catch (emailErr) {
    log.warn("Payment failed email error", { emailErr });
  }
}

async function handlePaymentIntentFailed(event: Stripe.Event) {
  const intent = event.data.object as Stripe.PaymentIntent;

  // Find any purchase linked via payment intent
  const [purchase] = await db
    .select({ id: purchases.id, studentId: purchases.studentId, courseId: purchases.courseId, status: purchases.status })
    .from(purchases)
    .where(eq(purchases.stripePaymentIntentId, intent.id))
    .limit(1);

  if (!purchase || purchase.status !== "pending") return;

  await db
    .update(purchases)
    .set({ status: "failed", updatedAt: new Date() })
    .where(eq(purchases.id, purchase.id));

  log.warn("Payment intent failed — purchase marked failed", {
    intentId:   intent.id,
    purchaseId: purchase.id,
    reason:     intent.last_payment_error?.message,
  });

  // Notify student
  try {
    const { EmailService } = await import("@/services/email.service");
    const [[studentRow], [courseRow]] = await Promise.all([
      db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, purchase.studentId)).limit(1),
      db.select({ title: courses.title }).from(courses).where(eq(courses.id, purchase.courseId)).limit(1),
    ]);
    if (studentRow?.email && courseRow) {
      await EmailService.paymentFailed(studentRow.email, {
        studentName: studentRow.name ?? "Student",
        courseTitle: courseRow.title,
      });
    }
  } catch (emailErr) {
    log.warn("Payment failed notification error", { emailErr });
  }
}

async function handleDisputeCreated(event: Stripe.Event) {
  const dispute = event.data.object as Stripe.Dispute;

  log.warn("Chargeback dispute created", {
    disputeId:       dispute.id,
    amount:          dispute.amount,
    reason:          dispute.reason,
    paymentIntentId: dispute.payment_intent,
  });

  // Alert admin
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const { EmailService } = await import("@/services/email.service");
      await EmailService.disputeAlert(adminEmail, {
        disputeId:   dispute.id,
        amount:      `£${(dispute.amount / 100).toFixed(2)}`,
        reason:      dispute.reason ?? "unknown",
        dueBy:       dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString("en-GB")
          : "unknown",
        stripeUrl:   `https://dashboard.stripe.com/disputes/${dispute.id}`,
      });
    }
  } catch (emailErr) {
    log.warn("Dispute alert email failed", { emailErr });
  }
}

async function handleTransferFailed(event: Stripe.Event) {
  const transfer = event.data.object as Stripe.Payout;

  log.error("Tutor payout transfer failed", {
    transferId:   transfer.id,
    amount:       transfer.amount,
    destination:  typeof transfer.destination === "string" ? transfer.destination : transfer.id,
  });

  // Alert admin — tutor won't receive their payment
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const { EmailService } = await import("@/services/email.service");
      await EmailService.transferFailed(adminEmail, {
        transferId:  transfer.id,
        amount:      `£${(transfer.amount / 100).toFixed(2)}`,
        destination: typeof transfer.destination === 'string' ? transfer.destination : transfer.id,
        stripeUrl:   `https://dashboard.stripe.com/connect/payouts/${transfer.id}`,
      });
    }
  } catch (emailErr) {
    log.warn("Transfer failed email error", { emailErr });
  }
}

async function handleAccountUpdated(event: Stripe.Event) {
  const account = event.data.object as Stripe.Account;

  const payoutsEnabled   = account.payouts_enabled   ?? false;
  const chargesEnabled   = account.charges_enabled   ?? false;
  const detailsSubmitted = account.details_submitted ?? false;

  const onboardingStatus = detailsSubmitted && payoutsEnabled
    ? "complete"
    : detailsSubmitted
    ? "in_progress"
    : "not_started";

  const [updated] = await db
    .update(users)
    .set({
      stripePayoutsEnabled:   payoutsEnabled,
      stripeChargesEnabled:   chargesEnabled,
      stripeOnboardingStatus: onboardingStatus as "complete" | "in_progress" | "not_started",
      updatedAt:              new Date(),
    })
    .where(eq(users.stripeAccountId, account.id))
    .returning({ id: users.id, email: users.email });

  if (updated) {
    log.info("Tutor Stripe account updated", {
      userId: updated.id,
      payoutsEnabled,
      onboardingStatus,
    });
  }
}
