import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { CourseService } from "@/services";
import { createCourseSchema, courseQuerySchema } from "@/lib/validations/course";
import {
  successResponse, createdResponse, unauthorized,
  forbidden, serverError, validationError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

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
    if (session.user.role !== "admin") return forbidden();

    const body   = await req.json();
    const parsed = createCourseSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const course = await CourseService.create(parsed.data, session.user.id);
    return createdResponse(course, "Course created successfully");
  } catch (error) {
    log.error("POST /api/courses", { error });
    return serverError();
  }
}
