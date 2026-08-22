import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courses, tutorAssignments, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { successResponse, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { EmailService } from "@/services/email.service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)               return unauthorized();
    if (session.user.role !== "admin") return forbidden("Admins only");

    const { id: courseId } = await params;

    const [course] = await db
      .select({ status: courses.status, title: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) return notFound("Course");

    await db
      .update(courses)
      .set({
        status:        "published",
        reviewedAt:    new Date(),
        reviewedBy:    session.user.id,
        rejectionNote: null,
      })
      .where(eq(courses.id, courseId));

    // Find the manager tutor to notify
    const [assignment] = await db
      .select({ tutorId: tutorAssignments.tutorId })
      .from(tutorAssignments)
      .where(
        and(
          eq(tutorAssignments.courseId,    courseId),
          eq(tutorAssignments.accessLevel, "manager"),
          eq(tutorAssignments.status,      "active")
        )
      )
      .limit(1);

    if (assignment) {
      const [tutor] = await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, assignment.tutorId))
        .limit(1);

      if (tutor?.email) {
        await EmailService.courseApproved(tutor.email, {
          courseTitle: course.title ?? "Untitled",
          courseUrl:   `${process.env.NEXT_PUBLIC_APP_URL}/courses`,
        }).catch(() => {});
      }
    }

    return successResponse({ approved: true });
  } catch {
    return serverError();
  }
}
