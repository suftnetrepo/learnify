import { NextRequest } from "next/server";
import { z } from "zod";
import { CourseMessagingService, MessagingError } from "@/services";
import { MAX_MESSAGE_LENGTH } from "@/services/messaging.service";
import { courseAccess } from "@/lib/messaging/route-helpers";
import { createdResponse, errorResponse, serverError, successResponse, validationError } from "@/lib/api-response";
import { log } from "@/lib/logger";

/** GET /api/announcements?courseId= — newest first. Enrolled students, assigned tutors, admins. */
export async function GET(req: NextRequest) {
  try {
    const courseId = new URL(req.url).searchParams.get("courseId");
    const access = await courseAccess(courseId);
    if (!access.ok) return errorResponse(access.message, "ACCESS_DENIED", access.status);
    return successResponse(await CourseMessagingService.announcements(courseId!));
  } catch (error) {
    log.error("List announcements failed", { error });
    return serverError();
  }
}

const postSchema = z.object({
  courseId: z.string().uuid(),
  content:  z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

/** POST /api/announcements { courseId, content } — assigned tutors and admins; broadcast live. */
export async function POST(req: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const access = await courseAccess(parsed.data.courseId);
    if (!access.ok) return errorResponse(access.message, "ACCESS_DENIED", access.status);
    const announcement = await CourseMessagingService.announce(access.viewer, parsed.data.courseId, parsed.data.content);
    return createdResponse(announcement, "Announcement sent");
  } catch (error) {
    if (error instanceof MessagingError) return errorResponse(error.message, "MESSAGING_ERROR", error.status);
    log.error("Post announcement failed", { error });
    return serverError();
  }
}
