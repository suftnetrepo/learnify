import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { lectureProgress, enrollments, lectures, courseSections, courses } from "@/db/schema";
import { eq, and, count, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  successResponse, unauthorized, serverError, validationError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

const progressSchema = z.object({
  watchedSeconds: z.number().int().min(0),
  isCompleted:    z.boolean().optional(),
});

// GET — fetch progress for a lecture
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id: lectureId } = await params;

    const [progress] = await db
      .select()
      .from(lectureProgress)
      .where(
        and(
          eq(lectureProgress.userId,    session.user.id),
          eq(lectureProgress.lectureId, lectureId)
        )
      )
      .limit(1);

    return successResponse(progress ?? { watchedSeconds: 0, isCompleted: false });
  } catch (error) {
    return serverError();
  }
}

// POST — upsert progress and optionally mark complete
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id: lectureId } = await params;

    const body   = await req.json();
    const parsed = progressSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const { watchedSeconds, isCompleted } = parsed.data;
    const userId = session.user.id;
    const now    = new Date();

    // Upsert progress record
    const [progress] = await db
      .insert(lectureProgress)
      .values({
        userId,
        lectureId,
        watchedSeconds,
        isCompleted:  isCompleted ?? false,
        completedAt:  isCompleted ? now : null,
      })
      .onConflictDoUpdate({
        target: [lectureProgress.userId, lectureProgress.lectureId],
        set: {
          watchedSeconds,
          // Only mark complete, never un-mark
          isCompleted:  isCompleted ? true : lectureProgress.isCompleted,
          completedAt:  isCompleted ? now  : lectureProgress.completedAt,
          updatedAt:    now,
        },
      })
      .returning();

    // If lecture just completed, recalculate enrollment progress
    if (isCompleted) {
      await recalculateCourseProgress(userId, lectureId);
    }

    return successResponse(progress);
  } catch (error) {
    log.error("POST /api/lectures/:id/progress", { error });
    return serverError();
  }
}

// ─── Recalculate overall course progress ──────────────────────────────────────
async function recalculateCourseProgress(userId: string, lectureId: string) {
  try {
    // Get course from lecture → section → course
    const [lectureRow] = await db
      .select({ sectionId: lectures.sectionId })
      .from(lectures)
      .where(eq(lectures.id, lectureId))
      .limit(1);

    if (!lectureRow) return;

    const [sectionRow] = await db
      .select({ courseId: courseSections.courseId })
      .from(courseSections)
      .where(eq(courseSections.id, lectureRow.sectionId))
      .limit(1);

    if (!sectionRow) return;

    const { courseId } = sectionRow;

    // Count total published lectures in course
    const sectionsInCourse = await db
      .select({ id: courseSections.id })
      .from(courseSections)
      .where(eq(courseSections.courseId, courseId));

    if (!sectionsInCourse.length) return;

    const sectionIds = sectionsInCourse.map((s) => s.id);

    const [{ totalLectures }] = await db
      .select({ totalLectures: count() })
      .from(lectures)
      .where(and(inArray(lectures.sectionId, sectionIds), eq(lectures.isPublished, true)));

    if (!totalLectures) return;

    // Count completed lectures by this user
    const allLectureIds = await db
      .select({ id: lectures.id })
      .from(lectures)
      .where(and(inArray(lectures.sectionId, sectionIds), eq(lectures.isPublished, true)));

    const lectureIds = allLectureIds.map((l) => l.id);

    const [{ completedLectures }] = await db
      .select({ completedLectures: count() })
      .from(lectureProgress)
      .where(
        and(
          eq(lectureProgress.userId, userId),
          eq(lectureProgress.isCompleted, true),
          inArray(lectureProgress.lectureId, lectureIds)
        )
      );

    const progressPercent = Math.round((completedLectures / totalLectures) * 100);

    // Update enrollment progress
    await db
      .update(enrollments)
      .set({
        progress:    progressPercent,
        completedAt: progressPercent >= 100 ? new Date() : null,
      })
      .where(
        and(
          eq(enrollments.studentId, userId),
          eq(enrollments.courseId,  courseId)
        )
      );

    // Fire-and-forget: generate certificate + send completion email
    // Do NOT await — this can take 3-5s and must not block the response
    if (progressPercent >= 100) {
      void (async () => {
        try {
          const { generateAndStoreCertificate } = await import("@/lib/certificate");
          const certUrl = await generateAndStoreCertificate(userId, courseId).catch((err) => {
            log.error("Certificate generation failed", { err });
            return null;
          });

          const { EmailService } = await import("@/services/email.service");
          const { db: dbInner }  = await import("@/db");
          const { users: usersTable, courses: coursesTable } = await import("@/db/schema");
          const { eq: eqFn } = await import("drizzle-orm");
          const [[studentRow], [courseRow]] = await Promise.all([
            dbInner.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eqFn(usersTable.id, userId)).limit(1),
            dbInner.select({ title: coursesTable.title }).from(coursesTable).where(eqFn(coursesTable.id, courseId)).limit(1),
          ]);
          if (studentRow?.email && courseRow) {
            await EmailService.courseCompleted(studentRow.email, {
              studentName:    studentRow.name ?? "Student",
              courseTitle:    courseRow.title,
              certificateUrl: certUrl ?? undefined,
            });
          }
        } catch (bgErr) {
          log.warn("Background certificate/email task failed", { bgErr });
        }
      })();
    }

    log.info("Course progress updated", { userId, courseId, progressPercent });
  } catch (error) {
    log.error("recalculateCourseProgress failed", { error });
  }
}
