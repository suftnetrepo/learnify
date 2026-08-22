import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tutorAssignments } from "@/db/schema";
import { CourseService } from "@/services";
import { createCourseSchema, courseQuerySchema } from "@/lib/validations/course";
import {
  successResponse, createdResponse, unauthorized,
  forbidden, serverError, validationError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";
import { requireCourseCreate } from "@/lib/access/course";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = courseQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const result = await CourseService.list(parsed.data);
    return successResponse(result);
  } catch (error) {
    log.error("GET /api/courses", { error });
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    // Allow admins and manager tutors (when the flag is on)
    const canCreate = await requireCourseCreate(session.user.id, session.user.role);
    if (!canCreate) return forbidden("Insufficient access to create courses");

    const body   = await req.json();
    const parsed = createCourseSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const course = await CourseService.create(parsed.data, session.user.id);

    // Manager-tutor courses need an assignment row so requireCourseAccess
    // recognises them as the (manager-level) owner on subsequent requests.
    if (session.user.role === "tutor") {
      await db.insert(tutorAssignments).values({
        tutorId:     session.user.id,
        courseId:    course.id,
        accessLevel: "manager",
        status:      "active",
        startDate:   new Date(),
        endDate:     new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    return createdResponse(course, "Course created successfully");
  } catch (error) {
    log.error("POST /api/courses", { error });
    return serverError();
  }
}
