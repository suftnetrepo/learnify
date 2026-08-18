import { NextRequest } from "next/server";
import crypto from "crypto";
import { calculatePlatformFee } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courses, enrollments, purchases, tutorAssignments, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { createCheckoutSession } from "@/lib/stripe";
import {
  successResponse, unauthorized, forbidden,
  notFound, serverError, validationError, conflict, tooManyRequests,
} from "@/lib/api-response";
import { limiters } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

const schema = z.object({
  courseId:  z.string().uuid(),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "student") {
      return forbidden("Only students can purchase courses.");
    }

    // Rate limit: 5 checkout attempts per student per 10 minutes
    const limit = limiters.checkout(session.user.id);
    if (!limit.success) return tooManyRequests("Too many checkout attempts — please wait a few minutes");

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const { courseId, sessionId } = parsed.data;
    const studentId    = session.user.id;

    // Fetch course
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.status, "published")))
      .limit(1);

    if (!course) return notFound("Course");

    // Check not already enrolled
    const [existingEnrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
      .limit(1);

    if (existingEnrollment) {
      return conflict("You are already enrolled in this course.");
    }

    // Validate session if provided
    if (sessionId) {
      const { SessionService } = await import("@/services/session.service");
      const sess = await SessionService.findById(sessionId);
      if (!sess) return notFound("Session");
      if (sess.courseId !== courseId) return validationError({ sessionId: ["Session does not belong to this course"] });
      if (sess.isFull)  return conflict("This session is full. Please choose another.");
      if (sess.status !== "scheduled") return conflict("This session is no longer available.");
    }

    // Short-circuit: free courses get instant enrollment without Stripe
    if (Number(course.price) === 0) {
      const { EnrollmentService } = await import("@/services/enrollment.service");
      await EnrollmentService.enroll(studentId, courseId);

      // Record a £0 purchase for audit trail
      await db.insert(purchases).values({
        studentId,
        courseId,
        amount:      "0",
        platformFee: "0",
        tutorAmount: "0",
        currency:    "gbp",
        status:      "completed",
        stripeEventId: `free-${crypto.randomUUID()}`,
      });

      return successResponse({ url: `${process.env.NEXT_PUBLIC_APP_URL}/learn/${courseId}` }, "Enrolled in free course");
    }

    // Find the active tutor assignment for payment routing
    const [assignment] = await db
      .select({ tutorId: tutorAssignments.tutorId })
      .from(tutorAssignments)
      .where(and(eq(tutorAssignments.courseId, courseId), eq(tutorAssignments.status, "active")))
      .limit(1);

    let tutorStripeId: string | null = null;
    if (assignment?.tutorId) {
      const [tutor] = await db
        .select({ stripeAccountId: users.stripeAccountId, stripePayoutsEnabled: users.stripePayoutsEnabled })
        .from(users)
        .where(eq(users.id, assignment.tutorId))
        .limit(1);

      // Only route to Connect if tutor is fully onboarded
      if (tutor?.stripePayoutsEnabled && tutor.stripeAccountId) {
        tutorStripeId = tutor.stripeAccountId;
      }
    }

    const stripeSession = await createCheckoutSession({
      courseId,
      courseTitle:   course.title,
      courseSlug:    course.slug,
      priceInPounds: Number(course.price),
      studentId,
      studentEmail:  session.user.email!,
      tutorStripeId,
      thumbnailUrl:  course.thumbnailUrl,
      sessionId,
    });

    // Create a pending purchase record immediately for idempotency
    const { platformFee, tutorAmount } = calculatePlatformFee(Number(course.price));

    await db.insert(purchases).values({
      studentId,
      courseId,
      tutorId:         assignment?.tutorId ?? null,
      amount:          String(course.price),
      platformFee:     String(platformFee),
      tutorAmount:     String(tutorAmount),
      currency:        "gbp",
      stripeSessionId: stripeSession.id,
      status:          "pending",
    });

    log.info("Checkout session created", {
      sessionId: stripeSession.id,
      courseId,
      studentId,
    });

    return successResponse({ url: stripeSession.url }, "Checkout session created");
  } catch (error) {
    log.error("POST /api/stripe/checkout error", { error });
    return serverError("Failed to create checkout session.");
  }
}
