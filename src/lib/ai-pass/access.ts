/**
 * Who gets which kind of AI Tutor token for a course — decided on the server from the database.
 * Nothing here trusts the browser (no client-supplied pass ids, prices or eligibility).
 *
 *   paid          → enrolled in a paid course (or a now-free course bought for real money):
 *                   the existing unrestricted StudyMind session, unchanged
 *   pass          → enrolled in a free course with a current AI Tutor Pass: a usage-limited session
 *   pass_required → enrolled in a free course, feature on, no current pass: no token
 *   unavailable   → free course with the feature off: exactly today's behaviour (no AI tutor)
 *   not_enrolled  → no token
 */
import { db } from "@/db";
import { courses, enrollments, type AiTutorPass } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isAiTutorPassEnabled } from "@/lib/flags";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";

export type StudentAiAccess =
  | { kind: "paid"; grandfathered: boolean }
  | { kind: "pass"; pass: AiTutorPass }
  | { kind: "pass_required" }
  | { kind: "unavailable" }
  | { kind: "not_enrolled" };

export async function resolveStudentAiAccess(studentId: string, courseId: string, now = new Date()): Promise<StudentAiAccess> {
  const [row] = await db
    .select({ price: courses.price, enrollmentId: enrollments.id })
    .from(courses)
    .leftJoin(enrollments, and(eq(enrollments.courseId, courses.id), eq(enrollments.studentId, studentId)))
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!row) return { kind: "not_enrolled" };

  const isFree = Number(row.price) <= 0;
  // Flag off: free courses behave exactly as before — no AI tutor, whatever else is true
  if (isFree && !isAiTutorPassEnabled()) return { kind: "unavailable" };
  if (!row.enrollmentId) return { kind: "not_enrolled" };
  if (!isFree) return { kind: "paid", grandfathered: false };

  // Bought before the course became free (a zero-value enrolment never qualifies)
  if (await AiTutorPassService.hasGenuinePaidPurchase(studentId, courseId)) return { kind: "paid", grandfathered: true };

  const pass = await AiTutorPassService.currentPass(studentId, now);
  return pass ? { kind: "pass", pass } : { kind: "pass_required" };
}
