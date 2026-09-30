import { db } from "@/db";
import { purchases, enrollments, users, courses, courseReviews } from "@/db/schema";
import { eq, gte, lt, desc, count, countDistinct, sum, avg, and, isNull, sql } from "drizzle-orm";
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
    const now       = new Date();
    const thirtyAgo = new Date(now.getTime() - 30 * 86400000);
    const sixtyAgo  = new Date(now.getTime() - 60 * 86400000);

    // "Students" = active, non-deleted student accounts (suspended/deleted excluded)
    const activeStudent = and(eq(users.role, "student"), eq(users.status, "active"), isNull(users.deletedAt));
    const completed     = eq(purchases.status, "completed");
    const published     = eq(courseReviews.isPublished, true);

    const [
      [totalRevenue],
      [monthRevenue],
      [prevMonthRevenue],
      [totalStudents],
      [newStudents],
      [prevNewStudents],
      [enrolledStudents],
      [totalEnrollments],
      [reviews],
      [publishedCount],
    ] = await Promise.all([
      db.select({ v: sum(purchases.amount) }).from(purchases).where(completed),
      db.select({ v: sum(purchases.amount) }).from(purchases).where(and(completed, gte(purchases.createdAt, thirtyAgo))),
      db.select({ v: sum(purchases.amount) }).from(purchases).where(
        and(completed, gte(purchases.createdAt, sixtyAgo), lt(purchases.createdAt, thirtyAgo))
      ),
      db.select({ v: count() }).from(users).where(activeStudent),
      db.select({ v: count() }).from(users).where(and(activeStudent, gte(users.createdAt, thirtyAgo))),
      db.select({ v: count() }).from(users).where(
        and(activeStudent, gte(users.createdAt, sixtyAgo), lt(users.createdAt, thirtyAgo))
      ),
      db.select({ v: countDistinct(enrollments.studentId) })
        .from(enrollments)
        .innerJoin(users, eq(users.id, enrollments.studentId))
        .where(activeStudent),
      db.select({ v: count() }).from(enrollments),
      // Rating and review count use the same set: published reviews only
      db.select({ avg: avg(courseReviews.rating), n: count() }).from(courseReviews).where(published),
      db.select({ v: count() }).from(courses).where(eq(courses.status, "published")),
    ]);

    const monthRev = Number(monthRevenue.v ?? 0);
    const prevRev  = Number(prevMonthRevenue.v ?? 0);

    return {
      totalRevenue:     Number(totalRevenue.v ?? 0),
      monthRevenue:     monthRev,
      prevMonthRevenue: prevRev,
      revenueChange:    prevRev > 0 ? Math.round(((monthRev - prevRev) / prevRev) * 100) : null,
      revenueTrend:     trend(monthRev, prevRev),
      totalStudents:    totalStudents.v,
      newStudents:      newStudents.v,
      prevNewStudents:  prevNewStudents.v,
      studentsTrend:    trend(newStudents.v, prevNewStudents.v),
      enrolledStudents: enrolledStudents.v,
      totalEnrollments: totalEnrollments.v,
      avgRating:        Number(reviews.avg ?? 0).toFixed(1),
      totalReviews:     reviews.n,
      publishedCourses: publishedCount.v,
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
      // Courses with no sales have a NULL sum, which Postgres sorts first in DESC — treat as 0
      .orderBy(desc(sql`coalesce(${sum(purchases.amount)}, 0)`), desc(courses.enrollmentCount))
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

/** Direction of this period vs the previous one, for up/down/neutral indicators. */
function trend(current: number, previous: number): "up" | "down" | "neutral" {
  return current > previous ? "up" : current < previous ? "down" : "neutral";
}
