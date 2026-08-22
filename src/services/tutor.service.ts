import { db } from "@/db";
import { tutorAssignments, tutorInvitations, users } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { log } from "@/lib/logger";
import type {
  TutorAssignmentWithDetails, TutorInvitation, AssignTutorPayload,
} from "@/types";

export class TutorService {
  /**
   * All assignments for a course (active + past).
   */
  static async getAssignmentsForCourse(courseId: string): Promise<TutorAssignmentWithDetails[]> {
    const rows = await db
      .select({
        id:         tutorAssignments.id,
        courseId:   tutorAssignments.courseId,
        tutorId:    tutorAssignments.tutorId,
        assignedBy: tutorAssignments.assignedBy,
        startDate:   tutorAssignments.startDate,
        endDate:     tutorAssignments.endDate,
        status:      tutorAssignments.status,
        accessLevel: tutorAssignments.accessLevel,
        notes:       tutorAssignments.notes,
        createdAt:  tutorAssignments.createdAt,
        updatedAt:  tutorAssignments.updatedAt,
        tutorName:  users.name,
        tutorEmail: users.email,
      })
      .from(tutorAssignments)
      .leftJoin(users, eq(tutorAssignments.tutorId, users.id))
      .where(eq(tutorAssignments.courseId, courseId))
      .orderBy(desc(tutorAssignments.createdAt));

    return rows as TutorAssignmentWithDetails[];
  }

  /**
   * Active assignment for a tutor on a specific course.
   */
  static async getActiveAssignment(
    tutorId: string,
    courseId: string
  ): Promise<TutorAssignmentWithDetails | null> {
    const [row] = await db
      .select()
      .from(tutorAssignments)
      .where(
        and(
          eq(tutorAssignments.tutorId,  tutorId),
          eq(tutorAssignments.courseId, courseId),
          eq(tutorAssignments.status,   "active")
        )
      )
      .limit(1);

    return (row as TutorAssignmentWithDetails) ?? null;
  }

  /**
   * Create a new tutor assignment.
   * Validates the tutor is active and no duplicate active assignment exists.
   */
  static async assign(payload: AssignTutorPayload, assignedBy: string) {
    // Guard: check tutor is active
    const [tutor] = await db
      .select({ id: users.id, status: users.status, role: users.role })
      .from(users)
      .where(eq(users.id, payload.tutorId))
      .limit(1);

    if (!tutor || tutor.role !== "tutor") throw new Error("Tutor not found");
    if (tutor.status !== "active")        throw new Error("Tutor account is not active");

    // Guard: no duplicate
    const existing = await TutorService.getActiveAssignment(payload.tutorId, payload.courseId);
    if (existing) throw new Error("This tutor already has an active assignment for this course");

    const [assignment] = await db
      .insert(tutorAssignments)
      .values({
        courseId:   payload.courseId,
        tutorId:    payload.tutorId,
        assignedBy,
        startDate:  new Date(payload.startDate),
        endDate:    new Date(payload.endDate),
        status:     "active",
        notes:      payload.notes ?? null,
      })
      .returning();

    log.info("Tutor assigned", { assignmentId: assignment.id, ...payload, by: assignedBy });
    return assignment;
  }

  /**
   * Cancel an active assignment.
   */
  static async cancelAssignment(assignmentId: string, cancelledBy: string) {
    const [updated] = await db
      .update(tutorAssignments)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(tutorAssignments.id, assignmentId))
      .returning();

    log.info("Assignment cancelled", { assignmentId, by: cancelledBy });
    return updated;
  }

  /**
   * Pending invitations not yet accepted or revoked.
   */
  static async getPendingInvitations(): Promise<TutorInvitation[]> {
    return db
      .select()
      .from(tutorInvitations)
      .where(eq(tutorInvitations.status, "pending"))
      .orderBy(desc(tutorInvitations.createdAt)) as Promise<TutorInvitation[]>;
  }

  /**
   * Find an invitation by token — used during registration.
   */
  static async findInvitationByToken(token: string): Promise<TutorInvitation | null> {
    const [inv] = await db
      .select()
      .from(tutorInvitations)
      .where(eq(tutorInvitations.token, token))
      .limit(1);

    return (inv as TutorInvitation) ?? null;
  }

  /**
   * Create a new invitation (idempotent — revokes existing pending invite first).
   */
  static async createInvitation(email: string, invitedBy: string): Promise<TutorInvitation> {
    // Revoke any existing pending invite for this email
    await db
      .update(tutorInvitations)
      .set({ status: "revoked" })
      .where(
        and(
          eq(tutorInvitations.email,  email),
          eq(tutorInvitations.status, "pending")
        )
      );

    const token     = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [inv] = await db
      .insert(tutorInvitations)
      .values({ email, token, expiresAt, status: "pending" })
      .returning();

    log.info("Tutor invited", { email, by: invitedBy });
    return inv as TutorInvitation;
  }

  /**
   * Revoke a pending invitation.
   */
  static async revokeInvitation(inviteId: string, revokedBy: string) {
    const [updated] = await db
      .update(tutorInvitations)
      .set({ status: "revoked" })
      .where(eq(tutorInvitations.id, inviteId))
      .returning();

    log.info("Invitation revoked", { inviteId, by: revokedBy });
    return updated;
  }

  /**
   * Mark invitation as accepted.
   */
  static async acceptInvitation(token: string) {
    await db
      .update(tutorInvitations)
      .set({ status: "accepted" })
      .where(eq(tutorInvitations.token, token));
  }

  /**
   * Instructor courses page — all assignments with course/student/earnings data.
   */
  static async getInstructorCoursesData(tutorId: string) {
    const { db } = await import("@/db");
    const { tutorAssignments, courses, categories, enrollments, purchases } = await import("@/db/schema");
    const { eq, and, count, sum } = await import("drizzle-orm");

    const assignments = await db
      .select({
        assignmentId:    tutorAssignments.id,
        courseId:        courses.id,
        courseTitle:     courses.title,
        courseSlug:      courses.slug,
        courseThumbnail: courses.thumbnailUrl,
        courseFormat:    courses.format,
        courseLevel:     courses.level,
        enrollmentCount: courses.enrollmentCount,
        averageRating:   courses.averageRating,
        categoryName:    categories.name,
        startDate:       tutorAssignments.startDate,
        endDate:         tutorAssignments.endDate,
        status:          tutorAssignments.status,
        accessLevel:     tutorAssignments.accessLevel,
        stripePayoutsEnabled:   (await import("@/db/schema")).users.stripePayoutsEnabled,
        stripeOnboardingStatus: (await import("@/db/schema")).users.stripeOnboardingStatus,
      })
      .from(tutorAssignments)
      .innerJoin(courses,    (await import("drizzle-orm")).eq(tutorAssignments.courseId, courses.id))
      .leftJoin(categories,  (await import("drizzle-orm")).eq(courses.categoryId, categories.id))
      .innerJoin((await import("@/db/schema")).users, (await import("drizzle-orm")).eq(tutorAssignments.tutorId, (await import("@/db/schema")).users.id))
      .where((await import("drizzle-orm")).eq(tutorAssignments.tutorId, tutorId))
      .orderBy((await import("drizzle-orm")).desc(tutorAssignments.createdAt));

    return assignments;
  }

}