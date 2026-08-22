import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireCourseAccess } from "@/lib/access/course";
import { successResponse, unauthorized, forbidden, notFound, serverError, errorResponse } from "@/lib/api-response";
import { EmailService } from "@/services/email.service";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id: courseId } = await params;

    const allowed = await requireCourseAccess(session.user.id, courseId, session.user.role, "manager");
    if (!allowed) return forbidden("Manager access required");

    const [course] = await db
      .select({ status: courses.status, title: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) return notFound("Course");
    if (course.status === "pending_review") {
      return errorResponse("Course is already pending review", "ALREADY_PENDING", 400);
    }
    if (course.status === "published") {
      return errorResponse("Course is already published", "ALREADY_PUBLISHED", 400);
    }

    await db
      .update(courses)
      .set({
        status:          "pending_review",
        pendingReviewAt: new Date(),
        rejectionNote:   null,
      })
      .where(eq(courses.id, courseId));

    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await EmailService.courseSubmittedForReview(adminEmail, {
        courseTitle:    course.title ?? "Untitled",
        instructorName: session.user.name ?? "Instructor",
        reviewUrl:      `${process.env.NEXT_PUBLIC_APP_URL}/admin/courses/pending`,
      }).catch(() => {});
    }

    return successResponse({ submitted: true });
  } catch {
    return serverError();
  }
}
