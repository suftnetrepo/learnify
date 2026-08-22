import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { CourseService } from "@/services";
import { updateCourseSchema } from "@/lib/validations/course";
import { requireCourseAccess } from "@/lib/access/course";
import {
  successResponse, unauthorized, forbidden,
  notFound, serverError, validationError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const course = await CourseService.findById(id);
    if (!course) return notFound("Course");
    return successResponse(course);
  } catch (error) {
    log.error("GET /api/courses/[id]", { error });
    return serverError();
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id } = await params;

    // Admins may edit any course. Manager-tutors may edit their own course's
    // content and price, but never its publish status through this route —
    // publishing only happens via submit-for-review → admin approval.
    const allowed = await requireCourseAccess(session.user.id, id, session.user.role, "manager");
    if (!allowed) return forbidden();

    const body   = await req.json();
    const parsed = updateCourseSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const payload = session.user.role === "admin"
      ? parsed.data
      : { ...parsed.data, status: undefined };

    const course = await CourseService.update(id, payload, session.user.id);
    return successResponse(course, "Course updated");
  } catch (error) {
    log.error("PATCH /api/courses/[id]", { error });
    return serverError();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const { id }   = await params;
    const outcome  = await CourseService.delete(id, session.user.id);
    return successResponse({ outcome }, outcome === "archived" ? "Course archived" : "Course deleted");
  } catch (error) {
    log.error("DELETE /api/courses/[id]", { error });
    return serverError();
  }
}
