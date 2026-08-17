import { db } from "@/db";
import { purchases, enrollments, courses } from "@/db/schema";
import { eq, and, desc, count, sum, gte, sql } from "drizzle-orm";
import { users } from "@/db/schema";
import { refundPayment } from "@/lib/stripe";
import { log } from "@/lib/logger";
import type {
  PaymentListResult, PaymentFilters, PaymentStats,
  PurchaseListItem, Purchase,
} from "@/types";

export class PaymentService {
  /**
   * Paginated purchase list — admin ledger view.
   */
  static async list(filters: PaymentFilters = {}): Promise<PaymentListResult> {
    const { page = 1, limit = 20, status, search } = filters;

    const conditions = [];
    if (status) conditions.push(eq(purchases.status, status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id:                    purchases.id,
          studentId:             purchases.studentId,
          courseId:              purchases.courseId,
          amount:                purchases.amount,
          platformFee:           purchases.platformFee,
          tutorAmount:           purchases.tutorAmount,
          currency:              purchases.currency,
          status:                purchases.status,
          stripePaymentIntentId: purchases.stripePaymentIntentId,
          stripeEventId:         purchases.stripeEventId,
          refundedAt:            purchases.refundedAt,
          createdAt:             purchases.createdAt,
          updatedAt:             purchases.updatedAt,
          courseTitle:           courses.title,
          studentName:           users.name,
          studentEmail:          users.email,
        })
        .from(purchases)
        .leftJoin(courses, eq(purchases.courseId, courses.id))
        .leftJoin(users,   eq(purchases.studentId, users.id))
        .where(where)
        .orderBy(desc(purchases.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),

      db.select({ total: count() }).from(purchases).where(where),
    ]);

    return {
      purchases: rows as PurchaseListItem[],
      pagination: {
        total, page, limit,
        totalPages:      Math.ceil(total / limit),
        hasNextPage:     page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Payment stats — total revenue, 30-day revenue, refund count.
   */
  static async getStats(): Promise<PaymentStats> {
    const thirtyAgo = new Date(Date.now() - 30 * 86400000);

    const [[totalRevenue], [monthRevenue], [refundCount]] = await Promise.all([
      db.select({ v: sum(purchases.amount) }).from(purchases).where(eq(purchases.status, "completed")),
      db.select({ v: sum(purchases.amount) }).from(purchases).where(
        and(eq(purchases.status, "completed"), gte(purchases.createdAt, thirtyAgo))
      ),
      db.select({ v: count() }).from(purchases).where(eq(purchases.status, "refunded")),
    ]);

    return {
      totalRevenue: Number(totalRevenue.v ?? 0),
      monthRevenue: Number(monthRevenue.v ?? 0),
      refundCount:  Number(refundCount.v  ?? 0),
    };
  }

  /**
   * Find a purchase by ID.
   */
  static async findById(id: string): Promise<Purchase | null> {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.id, id))
      .limit(1);
    return (purchase as Purchase) ?? null;
  }

  /**
   * Check if a student has a completed purchase for a course.
   */
  static async hasPurchased(studentId: string, courseId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: purchases.id })
      .from(purchases)
      .where(
        and(
          eq(purchases.studentId, studentId),
          eq(purchases.courseId,  courseId),
          eq(purchases.status,    "completed")
        )
      )
      .limit(1);
    return !!row;
  }

  /**
   * Issue a refund via Stripe and update DB records.
   * Also revokes the student's enrollment and decrements course count.
   */
  static async issueRefund(purchaseId: string, refundedBy: string): Promise<void> {
    const purchase = await PaymentService.findById(purchaseId);
    if (!purchase)                      throw new Error("Purchase not found");
    if (purchase.status === "refunded") throw new Error("Already refunded");
    if (purchase.status !== "completed") throw new Error("Only completed purchases can be refunded");
    if (!purchase.stripePaymentIntentId) throw new Error("No payment intent on record");

    // Enforce 30-day refund window
    const daysSincePurchase = (Date.now() - new Date(purchase.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePurchase > 30) {
      throw new Error("Refund window expired — purchases can only be refunded within 30 days.");
    }

    await refundPayment(purchase.stripePaymentIntentId, "requested_by_customer");

    await db
      .update(purchases)
      .set({ status: "refunded", refundedAt: new Date(), updatedAt: new Date() })
      .where(eq(purchases.id, purchaseId));

    // Get enrollment to check for linked session
    const [enrollment] = await db
      .select({ id: enrollments.id, sessionId: enrollments.sessionId })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, purchase.studentId), eq(enrollments.courseId, purchase.courseId)))
      .limit(1);

    await db
      .delete(enrollments)
      .where(
        and(
          eq(enrollments.studentId, purchase.studentId),
          eq(enrollments.courseId,  purchase.courseId)
        )
      );

    // Release the session seat if one was booked
    if (enrollment?.sessionId) {
      const { SessionService } = await import("@/services/session.service");
      await SessionService.releaseSeat(enrollment.sessionId).catch((err) =>
        log.warn("Failed to release session seat on refund", { err, sessionId: enrollment.sessionId })
      );
    }

    await db
      .update(courses)
      .set({ enrollmentCount: sql`GREATEST(0, ${courses.enrollmentCount} - 1)` })
      .where(eq(courses.id, purchase.courseId));

    log.info("Refund issued", { purchaseId, by: refundedBy });
  }

  /**
   * Recent purchases for the admin dashboard widget.
   */
  static async getRecentPurchases(limit = 5) {
    return db
      .select({
        id:          purchases.id,
        amount:      purchases.amount,
        status:      purchases.status,
        createdAt:   purchases.createdAt,
        courseTitle: courses.title,
        studentName: users.name,
      })
      .from(purchases)
      .leftJoin(courses, eq(purchases.courseId, courses.id))
      .leftJoin(users,   eq(purchases.studentId, users.id))
      .orderBy(desc(purchases.createdAt))
      .limit(limit);
  }

  /**
   * Find a purchase by Stripe checkout session ID.
   */
  static async findByStripeSession(stripeSessionId: string) {
    const { courses } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [purchase] = await db
      .select({
        id:          purchases.id,
        amount:      purchases.amount,
        courseId:    purchases.courseId,
        courseTitle: courses.title,
        courseSlug:  courses.slug,
        status:      purchases.status,
      })
      .from(purchases)
      .leftJoin(courses, eq(purchases.courseId, courses.id))
      .where(eq(purchases.stripeSessionId, stripeSessionId))
      .limit(1);
    return purchase ?? null;
  }

}