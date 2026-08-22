import { db } from "@/db";
import { tutorAssignments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { isTutorManagerEnabled } from "@/lib/flags";

export type AccessLevel = "viewer" | "editor" | "manager";

const ACCESS_HIERARCHY: Record<AccessLevel, number> = {
  viewer:  0,
  editor:  1,
  manager: 2,
};

/**
 * Check if a user has at least the required access level on a course.
 * Admins always pass. Tutors must have an active assignment with sufficient accessLevel.
 */
export async function requireCourseAccess(
  userId:   string,
  courseId: string,
  role:     string,
  required: AccessLevel = "viewer"
): Promise<boolean> {
  if (role === "admin") return true;
  if (role !== "tutor") return false;

  const [assignment] = await db
    .select({ accessLevel: tutorAssignments.accessLevel })
    .from(tutorAssignments)
    .where(
      and(
        eq(tutorAssignments.tutorId,  userId),
        eq(tutorAssignments.courseId, courseId),
        eq(tutorAssignments.status,   "active")
      )
    )
    .limit(1);

  if (!assignment) return false;

  const granted  = ACCESS_HIERARCHY[assignment.accessLevel as AccessLevel] ?? 0;
  const required_ = ACCESS_HIERARCHY[required] ?? 0;

  // Manager access is only meaningful if the feature flag is on
  if (assignment.accessLevel === "manager" && !isTutorManagerEnabled()) {
    // Degrade manager to editor silently
    return ACCESS_HIERARCHY["editor"] >= required_;
  }

  return granted >= required_;
}

/**
 * Check if a tutor can create new courses on the platform.
 * Requires: feature flag on + tutor has at least one active manager assignment.
 */
export async function requireCourseCreate(
  userId: string,
  role:   string
): Promise<boolean> {
  if (role === "admin") return true;
  if (role !== "tutor") return false;
  if (!isTutorManagerEnabled()) return false;

  const [assignment] = await db
    .select({ id: tutorAssignments.id })
    .from(tutorAssignments)
    .where(
      and(
        eq(tutorAssignments.tutorId,    userId),
        eq(tutorAssignments.accessLevel, "manager"),
        eq(tutorAssignments.status,      "active")
      )
    )
    .limit(1);

  return !!assignment;
}
