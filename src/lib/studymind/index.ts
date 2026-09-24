/**
 * StudyMind AI integration — server-side helpers.
 *
 * Learnify never sends its StudyMind API key to the browser. The browser asks
 * /api/studymind/session for a short-lived session token scoped to one course
 * and user, and <StudyMindPanel> uses that.
 */
import { db } from "@/db";
import { courses, courseSections, lectures, enrollments } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireCourseAccess } from "@/lib/access/course";
import type { CourseData } from "@studymind/react";

export type StudyMindRole = "student" | "tutor" | "admin";

/**
 * Which StudyMind role (if any) a Learnify user gets for a course.
 * - admin               → "admin"
 * - tutor with editor+  → "tutor"   (can manage AI materials)
 * - enrolled student    → "student"
 * - anyone else         → null      (no token)
 */
export async function getStudyMindRole(
  userId:   string,
  role:     string,
  courseId: string,
): Promise<StudyMindRole | null> {
  if (role === "admin") return "admin";

  if (role === "tutor") {
    return (await requireCourseAccess(userId, courseId, role, "editor")) ? "tutor" : null;
  }

  const [enrollment] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.studentId, userId), eq(enrollments.courseId, courseId)))
    .limit(1);
  return enrollment ? "student" : null;
}

/**
 * The course outline StudyMind indexes: title, short description and the
 * published lectures, in curriculum order.
 *
 * Both the student course player and the tutor's AI Materials tab must send
 * exactly this — StudyMind re-indexes a course whenever the content it receives
 * differs, so two different versions would re-index on every page view.
 */
export async function loadStudyMindCourseData(courseId: string): Promise<CourseData | null> {
  const [course] = await db
    .select({ title: courses.title, shortDescription: courses.shortDescription })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course) return null;

  const sections = await db
    .select({ id: courseSections.id, title: courseSections.title })
    .from(courseSections)
    .where(eq(courseSections.courseId, courseId))
    .orderBy(courseSections.sortOrder);

  const sectionIds = sections.map((s) => s.id);
  const lectureRows = sectionIds.length
    ? await db
        .select({
          sectionId:   lectures.sectionId,
          title:       lectures.title,
          description: lectures.description,
        })
        .from(lectures)
        .where(and(inArray(lectures.sectionId, sectionIds), eq(lectures.isPublished, true)))
        .orderBy(lectures.sortOrder)
    : [];

  return {
    title:       course.title,
    description: course.shortDescription ?? undefined,
    sections:    sections.map((s) => ({
      title:    s.title,
      lectures: lectureRows
        .filter((l) => l.sectionId === s.id)
        .map((l) => ({ title: l.title, description: l.description ?? undefined })),
    })),
  };
}
