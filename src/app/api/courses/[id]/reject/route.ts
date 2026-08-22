import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courses, tutorAssignments, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { successResponse, unauthorized, forbidden, notFound, serverError, validationError } from "@/lib/api-response";
import { EmailService } from "@/services/email.service";

const schema = z.object({
  note: z.string().min(10, "Please provide a reason of at least 10 characters"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)               return unauthorized();
    if (session.user.role !== "admin") return forbidden("Admins only");

    const { id: courseId } = await params;
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const [course] = await db
      .select({ status: courses.status, title: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) return notFound("Course");

    await db
      .update(courses)
      .set({
        status:        "draft",
        reviewedAt:    new Date(),
        reviewedBy:    session.user.id,
        rejectionNote: parsed.data.note,
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
        await EmailService.courseRejected(tutor.email, {
          courseTitle:   course.title ?? "Untitled",
          rejectionNote: parsed.data.note,
          editUrl:       `${process.env.NEXT_PUBLIC_APP_URL}/instructor/courses`,
        }).catch(() => {});
      }
    }

    return successResponse({ rejected: true });
  } catch {
    return serverError();
  }
}
