import { db } from "@/db";
import { enrollments, lectureProgress, lectures, courses, courseSections } from "@/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { categories } from "@/db/schema";
import { log } from "@/lib/logger";
import type { EnrolledCourse, Enrollment } from "@/types";

export class EnrollmentService {
  /**
   * Check if a student is enrolled in a course.
   */
  static async isEnrolled(studentId: string, courseId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId,  courseId)
        )
      )
      .limit(1);
    return !!row;
  }

  /**
   * Get enrollment record.
   */
  static async findEnrollment(
    studentId: string,
    courseId: string
  ): Promise<Enrollment | null> {
    const [row] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId,  courseId)
        )
      )
      .limit(1);
    return (row as unknown as Enrollment) ?? null;
  }

  /**
   * All courses a student is enrolled in — student dashboard.
   */
  static async getEnrolledCourses(studentId: string): Promise<EnrolledCourse[]> {
    const rows = await db
      .select({
        enrollmentId:   enrollments.id,
        courseId:       courses.id,
        title:          courses.title,
        slug:           courses.slug,
        thumbnailUrl:   courses.thumbnailUrl,
        totalLectures:  courses.totalLectures,
        totalDuration:  courses.totalDuration,
        progress:       enrollments.progress,
        completedAt:    enrollments.completedAt,
        certificateUrl: enrollments.certificateUrl,
        categoryName:   categories.name,
      })
      .from(enrollments)
      .leftJoin(courses,    eq(enrollments.courseId, courses.id))
      .leftJoin(categories, eq(courses.categoryId,   categories.id))
      .where(eq(enrollments.studentId, studentId))
      .orderBy(enrollments.enrolledAt);

    return rows as EnrolledCourse[];
  }

  /**
   * Create a new enrollment.
   */
  static async enroll(studentId: string, courseId: string, sessionId?: string | null): Promise<Enrollment> {
    const [enrollment] = await db
      .insert(enrollments)
      .values({ studentId, courseId, sessionId: sessionId ?? null, progress: 0 })
      .returning();

    await db
      .update(courses)
      .set({ enrollmentCount: sql`${courses.enrollmentCount} + 1` })
      .where(eq(courses.id, courseId));

    log.info("Student enrolled", { studentId, courseId, sessionId });
    return enrollment as unknown as Enrollment;
  }

  /**
   * Update lecture progress and recalculate course progress percentage.
   */
  static async updateProgress(
    studentId:  string,
    lectureId:  string,
    courseId:   string,
    completed:  boolean,
    position?:  number
  ) {
    // Upsert lecture progress
    await db
      .insert(lectureProgress)
      .values({ userId: studentId, lectureId, isCompleted: completed, watchedSeconds: position ?? 0 })
      .onConflictDoUpdate({
        target: [lectureProgress.userId, lectureProgress.lectureId],
        set:    {
          isCompleted:    completed,
          watchedSeconds: position ?? sql`${lectureProgress.watchedSeconds}`,
          completedAt:    completed ? new Date() : null,
        },
      });

    // Recalculate course progress
    const [[{ total }], [{ done }]] = await Promise.all([
      db
        .select({ total: count() })
        .from(lectures)
        .innerJoin(courseSections, eq(lectures.sectionId, courseSections.id))
        .where(and(eq(courseSections.courseId, courseId), eq(lectures.isPublished, true))),
      db
        .select({ done: count() })
        .from(lectureProgress)
        .innerJoin(lectures, eq(lectureProgress.lectureId, lectures.id))
        .innerJoin(courseSections, eq(lectures.sectionId, courseSections.id))
        .where(
          and(
            eq(lectureProgress.userId, studentId),
            eq(lectureProgress.isCompleted, true),
            eq(courseSections.courseId, courseId),
            eq(lectures.isPublished, true)
          )
        ),
    ]);

    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    await db
      .update(enrollments)
      .set({
        progress,
        completedAt: progress === 100 ? new Date() : null,
      })
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId,  courseId)
        )
      );

    return { progress, total, done };
  }

  /**
   * Get lecture progress for a student in a course.
   */
  static async getLectureProgress(studentId: string, courseId: string) {
    return db
      .select({
        lectureId:    lectureProgress.lectureId,
        completed:    lectureProgress.isCompleted,
        watchedSeconds: lectureProgress.watchedSeconds,
      })
      .from(lectureProgress)
      .where(eq(lectureProgress.userId, studentId));
  }

  /**
   * Store certificate URL on enrollment.
   */
  static async saveCertificate(
    studentId: string,
    courseId:  string,
    url:       string
  ) {
    await db
      .update(enrollments)
      .set({ certificateUrl: url })
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId,  courseId)
        )
      );
  }

  /**
   * Student dashboard — all enrolled courses with progress + stats.
   */
  static async getDashboardData(studentId: string) {
    const { enrollments, courses, categories, purchases } = await import("@/db/schema");
    const { eq, and, desc, count, isNull } = await import("drizzle-orm");

    const [enrolled, [{ totalSpent }], [{ totalCourses }]] = await Promise.all([
      db.select({
        enrollmentId:    enrollments.id,
        courseId:        enrollments.courseId,
        courseTitle:     courses.title,
        courseSlug:      courses.slug,
        courseThumbnail: courses.thumbnailUrl,
        courseFormat:    courses.format,
        totalDuration:   courses.totalDuration,
        categoryName:    categories.name,
        progress:        enrollments.progress,
        completedAt:     enrollments.completedAt,
        certificateUrl:  enrollments.certificateUrl,
        enrolledAt:      enrollments.enrolledAt,
      })
      .from(enrollments)
      .leftJoin(courses,    eq(enrollments.courseId, courses.id))
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(eq(enrollments.studentId, studentId))
      .orderBy(desc(enrollments.enrolledAt)),

      db.select({ totalSpent: (await import("drizzle-orm")).sum(purchases.amount) })
        .from(purchases)
        .where(and(eq(purchases.studentId, studentId), eq(purchases.status, "completed"))),

      db.select({ totalCourses: count() })
        .from(enrollments)
        .where(eq(enrollments.studentId, studentId)),
    ]);

    const completed  = enrolled.filter((e) => e.completedAt !== null).length;
    const inProgress = enrolled.filter((e) => !e.completedAt && Number(e.progress) > 0).length;

    return {
      enrolled,
      stats: {
        totalCourses:  Number(totalCourses),
        completed,
        inProgress,
        totalSpent:    Number(totalSpent ?? 0),
      },
    };
  }

  /**
   * Course viewer page — enrollment + course + sections data for a student.
   */
  static async getCourseViewerData(studentId: string, courseId: string) {
    const {
      enrollments, courses, courseSections, lectures: lecturesTable,
      lectureProgress, courseReviews,
    } = await import("@/db/schema");
    const { eq, and, inArray } = await import("drizzle-orm");

    const [enrollment] = await db
      .select({
        id:             enrollments.id,
        progress:       enrollments.progress,
        completedAt:    enrollments.completedAt,
        certificateUrl: enrollments.certificateUrl,
      })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
      .limit(1);

    if (!enrollment) return null;

    const [course] = await db
      .select({
        id:               courses.id,
        title:            courses.title,
        thumbnailUrl:     courses.thumbnailUrl,
        shortDescription: courses.shortDescription,
        whatYouLearn:     courses.whatYouLearn,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) return null;

    const sections = await db
      .select()
      .from(courseSections)
      .where(eq(courseSections.courseId, courseId))
      .orderBy(courseSections.sortOrder);

    const sectionIds = sections.map((s) => s.id);
    const allLectures = sectionIds.length
      ? await db
          .select({
            id:            lecturesTable.id,
            title:         lecturesTable.title,
            description:   lecturesTable.description,
            videoUrl:      lecturesTable.videoUrl,
            videoDuration: lecturesTable.videoDuration,
            isFree:        lecturesTable.isFree,
            sortOrder:     lecturesTable.sortOrder,
            sectionId:     lecturesTable.sectionId,
          })
          .from(lecturesTable)
          .where(and(
            inArray(lecturesTable.sectionId, sectionIds),
            eq(lecturesTable.isPublished, true)
          ))
          .orderBy(lecturesTable.sortOrder)
      : [];

    const lectureIds = allLectures.map((l) => l.id);
    const progressRows = lectureIds.length
      ? await db
          .select({
            lectureId:      lectureProgress.lectureId,
            watchedSeconds: lectureProgress.watchedSeconds,
            isCompleted:    lectureProgress.isCompleted,
          })
          .from(lectureProgress)
          .where(and(
            eq(lectureProgress.userId, studentId),
            inArray(lectureProgress.lectureId, lectureIds)
          ))
      : [];

    const progressMap = Object.fromEntries(
      progressRows.map((p) => [p.lectureId, { watchedSeconds: p.watchedSeconds, isCompleted: p.isCompleted }])
    );

    const [hasReviewed] = await db
      .select({ id: courseReviews.id })
      .from(courseReviews)
      .where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.studentId, studentId)))
      .limit(1);

    const sectionsWithLectures = sections.map((s) => ({
      ...s,
      lectures: allLectures.filter((l) => l.sectionId === s.id),
    }));

    return {
      enrollment,
      course,
      sectionsWithLectures,
      progressMap,
      hasReviewed:   !!hasReviewed,
      totalLectures: allLectures.length,
    };
  }

}