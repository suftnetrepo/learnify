import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courseReviews, enrollments, courses } from "@/db/schema";
import { eq, and, avg, count } from "drizzle-orm";
import { z } from "zod";
import {
  successResponse, createdResponse, unauthorized, forbidden,
  notFound, serverError, validationError, conflict,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  title:  z.string().max(120).optional(),
  body:   z.string().min(10, "Review must be at least 10 characters").max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)              return unauthorized();
    if (session.user.role !== "student") return forbidden("Only students can leave reviews");

    const { id: courseId } = await params;
    const studentId        = session.user.id;

    // Must be enrolled
    const [enrollment] = await db
      .select({ id: enrollments.id, progress: enrollments.progress })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
      .limit(1);

    if (!enrollment) return forbidden("You must be enrolled to leave a review");

    // Enforce minimum 25% progress before reviewing
    if (enrollment.progress < 25) {
      return forbidden("Complete at least 25% of the course before leaving a review");
    }

    // One review per student per course
    const [existing] = await db
      .select({ id: courseReviews.id })
      .from(courseReviews)
      .where(and(eq(courseReviews.studentId, studentId), eq(courseReviews.courseId, courseId)))
      .limit(1);

    if (existing) return conflict("You have already reviewed this course");

    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const [review] = await db
      .insert(courseReviews)
      .values({
        courseId,
        studentId,
        rating:      parsed.data.rating,
        title:       parsed.data.title  ?? null,
        body:        parsed.data.body   ?? null,
        isPublished: true,
      })
      .returning();

    // Recalculate course average rating and review count
    const [stats] = await db
      .select({ avg: avg(courseReviews.rating), total: count() })
      .from(courseReviews)
      .where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.isPublished, true)));

    await db
      .update(courses)
      .set({
        averageRating: String(Number(stats.avg ?? 0).toFixed(2)),
        reviewCount:   stats.total,
        updatedAt:     new Date(),
      })
      .where(eq(courses.id, courseId));

    log.info("Review submitted", { courseId, studentId, rating: parsed.data.rating });
    return createdResponse(review, "Review submitted successfully");
  } catch (error) {
    log.error("POST /api/courses/:id/reviews", { error });
    return serverError();
  }
}
