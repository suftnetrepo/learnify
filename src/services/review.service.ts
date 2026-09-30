import { db } from "@/db";
import { courseReviews, courses, enrollments, users } from "@/db/schema";
import { and, avg, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { log } from "@/lib/logger";

/** Students can review once they've completed this share of the course. */
export const REVIEW_MIN_PROGRESS = 25;

export class ReviewError extends Error {
  constructor(message: string, public status: 400 | 403 | 404 | 409) {
    super(message);
    this.name = "ReviewError";
  }
}

export interface ReviewInput {
  rating: number;
  title?: string | null;
  body?:  string | null;
}

export type ReviewVisibility = "all" | "published" | "hidden";

export class ReviewService {
  /**
   * Recompute a course's stored average rating and review count from its *published*
   * reviews. Called after every create/edit/hide/show/delete so the catalogue, course
   * page, tutor profiles and analytics never drift from the actual reviews.
   */
  static async recalculateCourse(courseId: string): Promise<void> {
    const [stats] = await db
      .select({ avg: avg(courseReviews.rating), total: count() })
      .from(courseReviews)
      .where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.isPublished, true)));

    await db
      .update(courses)
      .set({
        averageRating: Number(stats.avg ?? 0).toFixed(2),
        reviewCount:   stats.total,
        updatedAt:     new Date(),
      })
      .where(eq(courses.id, courseId));
  }

  /** The student's own review of a course (published or hidden), if any. */
  static async getOwn(studentId: string, courseId: string) {
    const [review] = await db
      .select({
        id: courseReviews.id, rating: courseReviews.rating, title: courseReviews.title,
        body: courseReviews.body, isPublished: courseReviews.isPublished, updatedAt: courseReviews.updatedAt,
      })
      .from(courseReviews)
      .where(and(eq(courseReviews.studentId, studentId), eq(courseReviews.courseId, courseId)))
      .limit(1);
    return review ?? null;
  }

  /** Enrolled students with at least REVIEW_MIN_PROGRESS% progress may review. */
  private static async assertCanReview(studentId: string, courseId: string) {
    const [enrollment] = await db
      .select({ progress: enrollments.progress })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
      .limit(1);
    if (!enrollment) throw new ReviewError("You must be enrolled to review this course", 403);
    if (enrollment.progress < REVIEW_MIN_PROGRESS) {
      throw new ReviewError(`Complete at least ${REVIEW_MIN_PROGRESS}% of the course to leave a review`, 403);
    }
  }

  static async create(studentId: string, courseId: string, input: ReviewInput) {
    await ReviewService.assertCanReview(studentId, courseId);
    if (await ReviewService.getOwn(studentId, courseId)) {
      throw new ReviewError("You have already reviewed this course — edit your review instead", 409);
    }
    const [review] = await db
      .insert(courseReviews)
      .values({ courseId, studentId, rating: input.rating, title: input.title || null, body: input.body || null, isPublished: true })
      .returning();
    await ReviewService.recalculateCourse(courseId);
    log.info("Review submitted", { courseId, studentId, rating: input.rating });
    return review;
  }

  /**
   * A student edits their own review. Visibility is untouched: a review hidden by a
   * moderator stays hidden after the student edits it.
   */
  static async updateOwn(studentId: string, reviewId: string, input: ReviewInput) {
    const [existing] = await db
      .select({ id: courseReviews.id, courseId: courseReviews.courseId, studentId: courseReviews.studentId })
      .from(courseReviews)
      .where(eq(courseReviews.id, reviewId))
      .limit(1);
    if (!existing || existing.studentId !== studentId) throw new ReviewError("Review not found", 404);
    await ReviewService.assertCanReview(studentId, existing.courseId);

    const [review] = await db
      .update(courseReviews)
      .set({ rating: input.rating, title: input.title || null, body: input.body || null, updatedAt: new Date() })
      .where(eq(courseReviews.id, reviewId))
      .returning();
    await ReviewService.recalculateCourse(existing.courseId);
    log.info("Review edited", { reviewId, studentId });
    return review;
  }

  /** Admin: hide a review from the public (and from the rating) or restore it. */
  static async setPublished(reviewId: string, isPublished: boolean, adminId: string) {
    const [review] = await db
      .update(courseReviews)
      .set({ isPublished, updatedAt: new Date() })
      .where(eq(courseReviews.id, reviewId))
      .returning();
    if (!review) throw new ReviewError("Review not found", 404);
    await ReviewService.recalculateCourse(review.courseId);
    log.info(isPublished ? "Review restored" : "Review hidden", { reviewId, by: adminId });
    return review;
  }

  /** Admin: permanently delete a review. The student may then write a new one. */
  static async remove(reviewId: string, adminId: string) {
    const [review] = await db.delete(courseReviews).where(eq(courseReviews.id, reviewId)).returning();
    if (!review) throw new ReviewError("Review not found", 404);
    await ReviewService.recalculateCourse(review.courseId);
    log.info("Review deleted", { reviewId, courseId: review.courseId, by: adminId });
  }

  /** Totals for the admin dashboard card and Reviews page header. */
  static async counts(): Promise<{ all: number; hidden: number; lowRated: number }> {
    const [c] = await db.select({
      all:      count(),
      hidden:   sql<number>`count(*) filter (where ${courseReviews.isPublished} = false)`.mapWith(Number),
      lowRated: sql<number>`count(*) filter (where ${courseReviews.rating} <= 2 and ${courseReviews.isPublished})`.mapWith(Number),
    }).from(courseReviews);
    return c;
  }

  /** Admin moderation list, newest first. */
  static async listForAdmin(filters: {
    visibility?: ReviewVisibility; rating?: number; search?: string; page?: number; limit?: number;
  }) {
    const limit = Math.min(filters.limit ?? 20, 100);
    const page  = Math.max(filters.page ?? 1, 1);

    const where: SQL[] = [];
    if (filters.visibility === "published") where.push(eq(courseReviews.isPublished, true));
    if (filters.visibility === "hidden")    where.push(eq(courseReviews.isPublished, false));
    if (filters.rating)                     where.push(eq(courseReviews.rating, filters.rating));
    if (filters.search?.trim()) {
      const q = `%${filters.search.trim()}%`;
      where.push(or(
        ilike(courses.title, q), ilike(users.name, q), ilike(users.email, q),
        ilike(courseReviews.title, q), ilike(courseReviews.body, q),
      )!);
    }
    const condition = where.length ? and(...where) : undefined;

    const base = db
      .select({
        id: courseReviews.id, rating: courseReviews.rating, title: courseReviews.title, body: courseReviews.body,
        isPublished: courseReviews.isPublished, createdAt: courseReviews.createdAt, updatedAt: courseReviews.updatedAt,
        courseId: courses.id, courseTitle: courses.title, courseSlug: courses.slug,
        studentName: users.name, studentEmail: users.email,
      })
      .from(courseReviews)
      .innerJoin(courses, eq(courses.id, courseReviews.courseId))
      .innerJoin(users, eq(users.id, courseReviews.studentId));

    const [rows, [{ total }], [counts]] = await Promise.all([
      base.where(condition).orderBy(desc(courseReviews.createdAt)).limit(limit).offset((page - 1) * limit),
      db.select({ total: count() })
        .from(courseReviews)
        .innerJoin(courses, eq(courses.id, courseReviews.courseId))
        .innerJoin(users, eq(users.id, courseReviews.studentId))
        .where(condition),
      ReviewService.counts().then((c) => [c]),
    ]);

    return { reviews: rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), counts };
  }
}
