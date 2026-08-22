import { db } from "@/db";
import { purchases, enrollments, users, courses, courseReviews } from "@/db/schema";
import { eq, gte, desc, count, sum, avg, and } from "drizzle-orm";
import type {
  PlatformStats, AdminDashboardStats, TopCourse,
  RecentTransaction, InstructorStats, InstructorTopCourse,
} from "@/types";

export class AnalyticsService {
  /**
   * KPI stats for the admin dashboard homepage.
   */
  static async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [
      [totalUsers],
      [totalCourses],
      [publishedCourses],
      [totalRevenue],
      [monthRevenue],
      [totalEnrollments],
      [pendingTutors],
      [pendingReviewCourses],
    ] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(courses),
      db.select({ count: count() }).from(courses).where(eq(courses.status, "published")),
      db.select({ total: sum(purchases.amount) }).from(purchases).where(eq(purchases.status, "completed")),
      db.select({ total: sum(purchases.amount) }).from(purchases).where(
        and(eq(purchases.status, "completed"), gte(purchases.createdAt, thirtyDaysAgo))
      ),
      db.select({ count: count() }).from(enrollments),
      db.select({ count: count() }).from(users).where(
        and(eq(users.role, "tutor"), eq(users.status, "pending"))
      ),
      db.select({ count: count() }).from(courses).where(eq(courses.status, "pending_review")),
    ]);

    return {
      totalUsers:       totalUsers.count,
      totalCourses:     totalCourses.count,
      publishedCourses: publishedCourses.count,
      totalRevenue:     Number(totalRevenue.total  ?? 0),
      monthRevenue:     Number(monthRevenue.total  ?? 0),
      totalEnrollments: totalEnrollments.count,
      pendingTutors:    pendingTutors.count,
      pendingReviewCourses: pendingReviewCourses.count,
    };
  }

  /**
   * Full analytics stats for the analytics page.
   */
  static async getPlatformStats(): Promise<PlatformStats> {
    const now        = new Date();
    const thirtyAgo  = new Date(now.getTime() - 30 * 86400000);
    const sixtyAgo   = new Date(now.getTime() - 60 * 86400000);

    const [
      [totalRevenue],
      [prevRevenue],
      [monthRevenue],
      [totalStudents],
      [newStudents],
      [totalEnrollments],
      [avgRating],
      [publishedCount],
      [totalReviews],
    ] = await Promise.all([
      db.select({ v: sum(purchases.amount) }).from(purchases).where(eq(purchases.status, "completed")),
      db.select({ v: sum(purchases.amount) }).from(purchases).where(
        and(eq(purchases.status, "completed"), gte(purchases.createdAt, sixtyAgo))
      ),
      db.select({ v: sum(purchases.amount) }).from(purchases).where(
        and(eq(purchases.status, "completed"), gte(purchases.createdAt, thirtyAgo))
      ),
      db.select({ v: count() }).from(users).where(eq(users.role, "student")),
      db.select({ v: count() }).from(users).where(
        and(eq(users.role, "student"), gte(users.createdAt, thirtyAgo))
      ),
      db.select({ v: count() }).from(enrollments),
      db.select({ v: avg(courseReviews.rating) }).from(courseReviews).where(eq(courseReviews.isPublished, true)),
      db.select({ v: count() }).from(courses).where(eq(courses.status, "published")),
      db.select({ v: count() }).from(courseReviews),
    ]);

    const totalRev  = Number(totalRevenue.v ?? 0);
    const monthRev  = Number(monthRevenue.v ?? 0);
    const prevRev   = Number(prevRevenue.v  ?? 0);
    const prevMonth = prevRev - monthRev;
    const revenueChange = prevMonth > 0
      ? Math.round(((monthRev - prevMonth) / prevMonth) * 100)
      : 0;

    return {
      totalRevenue:     totalRev,
      monthRevenue:     monthRev,
      revenueChange,
      totalStudents:    totalStudents.v,
      newStudents:      newStudents.v,
      totalEnrollments: totalEnrollments.v,
      avgRating:        Number(avgRating.v ?? 0).toFixed(1),
      publishedCourses: publishedCount.v,
      totalReviews:     totalReviews.v,
    };
  }

  /**
   * Top performing courses by revenue.
   */
  static async getTopCourses(limit = 8): Promise<TopCourse[]> {
    return db
      .select({
        id:              courses.id,
        title:           courses.title,
        enrollmentCount: courses.enrollmentCount,
        averageRating:   courses.averageRating,
        revenue:         sum(purchases.amount),
        status:          courses.status,
      })
      .from(courses)
      .leftJoin(
        purchases,
        and(eq(purchases.courseId, courses.id), eq(purchases.status, "completed"))
      )
      .where(eq(courses.status, "published"))
      .groupBy(courses.id)
      .orderBy(desc(sum(purchases.amount)))
      .limit(limit) as Promise<TopCourse[]>;
  }

  /**
   * Recent transactions feed.
   */
  static async getRecentTransactions(limit = 12): Promise<RecentTransaction[]> {
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
      .limit(limit) as Promise<RecentTransaction[]>;
  }

  /**
   * Earnings stats for an instructor.
   */
  static async getInstructorStats(tutorId: string): Promise<InstructorStats> {
    const now       = new Date();
    const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
    const sevenAgo  = new Date(now.getTime() -  7 * 86400000);

    const [[allTime], [month], [week], [students]] = await Promise.all([
      db.select({ v: sum(purchases.tutorAmount) }).from(purchases).where(
        and(eq(purchases.status, "completed"))
      ),
      db.select({ v: sum(purchases.tutorAmount) }).from(purchases).where(
        and(eq(purchases.status, "completed"), gte(purchases.createdAt, thirtyAgo))
      ),
      db.select({ v: sum(purchases.tutorAmount) }).from(purchases).where(
        and(eq(purchases.status, "completed"), gte(purchases.createdAt, sevenAgo))
      ),
      db.select({ v: count() }).from(enrollments).where(eq(enrollments.studentId, tutorId)),
    ]);

    return {
      allTimeEarnings: Number(allTime.v ?? 0),
      monthEarnings:   Number(month.v   ?? 0),
      weekEarnings:    Number(week.v    ?? 0),
      totalStudents:   Number(students.v ?? 0),
    };
  }

  /**
   * Full earnings page data for an instructor — stats + recent transactions + top courses + stripe status.
   */
  static async getInstructorEarnings(tutorId: string, limit = 10) {
    const now       = new Date();
    const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
    const sevenAgo  = new Date(now.getTime() -  7 * 86400000);


    const [
      [totalEarnings],
      [monthEarnings],
      [weekEarnings],
      [totalStudents],
      recentPayouts,
      topCourses,
      [stripeStatus],
    ] = await Promise.all([
      db.select({ total: sum(purchases.tutorAmount) }).from(purchases).where(and(eq(purchases.tutorId, tutorId), eq(purchases.status, "completed"))),
      db.select({ total: sum(purchases.tutorAmount) }).from(purchases).where(and(eq(purchases.tutorId, tutorId), eq(purchases.status, "completed"), gte(purchases.createdAt, thirtyAgo))),
      db.select({ total: sum(purchases.tutorAmount) }).from(purchases).where(and(eq(purchases.tutorId, tutorId), eq(purchases.status, "completed"), gte(purchases.createdAt, sevenAgo))),
      db.select({ count: count() }).from(purchases).where(and(eq(purchases.tutorId, tutorId), eq(purchases.status, "completed"))),
      db.select({ id: purchases.id, amount: purchases.amount, tutorAmount: purchases.tutorAmount, platformFee: purchases.platformFee, status: purchases.status, createdAt: purchases.createdAt, courseTitle: courses.title })
        .from(purchases).leftJoin(courses, eq(purchases.courseId, courses.id)).where(eq(purchases.tutorId, tutorId)).orderBy(desc(purchases.createdAt)).limit(limit),
      db.select({ courseId: courses.id, courseTitle: courses.title, thumbnailUrl: courses.thumbnailUrl, total: sum(purchases.tutorAmount), students: count() })
        .from(purchases).leftJoin(courses, eq(purchases.courseId, courses.id))
        .where(and(eq(purchases.tutorId, tutorId), eq(purchases.status, "completed")))
        .groupBy(courses.id, courses.title, courses.thumbnailUrl).orderBy(desc(sum(purchases.tutorAmount))).limit(5),
      db.select({ stripePayoutsEnabled: users.stripePayoutsEnabled, stripeOnboardingStatus: users.stripeOnboardingStatus, stripeAccountId: users.stripeAccountId })
        .from(users).where(eq(users.id, tutorId)).limit(1),
    ]);

    return {
      allTimeEarnings: Number(totalEarnings?.total  ?? 0),
      monthEarnings:   Number(monthEarnings?.total  ?? 0),
      weekEarnings:    Number(weekEarnings?.total   ?? 0),
      totalStudents:   Number(totalStudents?.count  ?? 0),
      recentPayouts,
      topCourses:      topCourses.map((t) => ({ ...t, total: Number(t.total ?? 0) })),
      stripe: {
        payoutsEnabled:    stripeStatus?.stripePayoutsEnabled   ?? false,
        onboardingStatus:  stripeStatus?.stripeOnboardingStatus ?? null,
        accountId:         stripeStatus?.stripeAccountId        ?? null,
      },
    };
  }

  /**
   * Top courses for an instructor by earnings.
   */
  static async getInstructorTopCourses(tutorId: string, limit = 5): Promise<InstructorTopCourse[]> {
    const rows = await db
      .select({
        courseId:  courses.id,
        title:     courses.title,
        students:  count(enrollments.id),
        earnings:  sum(purchases.tutorAmount),
      })
      .from(courses)
      .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
      .leftJoin(
        purchases,
        and(eq(purchases.courseId, courses.id), eq(purchases.status, "completed"))
      )
      .where(eq(courses.createdBy, tutorId))
      .groupBy(courses.id)
      .orderBy(desc(sum(purchases.tutorAmount)))
      .limit(limit);

    return rows.map((r) => ({
      courseId: r.courseId,
      title:    r.title,
      students: Number(r.students ?? 0),
      earnings: Number(r.earnings ?? 0),
    }));
  }
}
