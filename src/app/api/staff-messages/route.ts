import { NextRequest } from "next/server";
import { z } from "zod";
import { CourseMessagingService, MessagingError } from "@/services";
import { MAX_MESSAGE_LENGTH } from "@/services/messaging.service";
import { staffAccess } from "@/lib/messaging/route-helpers";
import { createdResponse, errorResponse, serverError, successResponse, validationError } from "@/lib/api-response";
import { log } from "@/lib/logger";

/**
 * GET /api/staff-messages?courseId=[&unread=1]
 *   The course's staff channel (assigned tutors ↔ admins), oldest first — or just { unread }.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const access = await staffAccess(courseId);
    if (!access.ok) return errorResponse(access.message, "ACCESS_DENIED", access.status);
    if (searchParams.get("unread") === "1") {
      return successResponse({ unread: await CourseMessagingService.staffUnread(access.viewer, courseId!) });
    }
    return successResponse(await CourseMessagingService.staffMessages(courseId!));
  } catch (error) {
    log.error("List staff messages failed", { error });
    return serverError();
  }
}

const postSchema = z.object({
  courseId: z.string().uuid(),
  content:  z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

/** POST /api/staff-messages { courseId, content } — assigned tutors and admins. */
export async function POST(req: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const access = await staffAccess(parsed.data.courseId);
    if (!access.ok) return errorResponse(access.message, "ACCESS_DENIED", access.status);
    const message = await CourseMessagingService.sendStaffMessage(access.viewer, parsed.data.courseId, parsed.data.content);
    return createdResponse(message, "Message sent");
  } catch (error) {
    if (error instanceof MessagingError) return errorResponse(error.message, "MESSAGING_ERROR", error.status);
    log.error("Send staff message failed", { error });
    return serverError();
  }
}

/** PATCH /api/staff-messages?courseId= — the viewer has read the channel. */
export async function PATCH(req: NextRequest) {
  try {
    const courseId = new URL(req.url).searchParams.get("courseId");
    const access = await staffAccess(courseId);
    if (!access.ok) return errorResponse(access.message, "ACCESS_DENIED", access.status);
    await CourseMessagingService.markStaffRead(access.viewer, courseId!);
    return successResponse({ read: true });
  } catch (error) {
    log.error("Mark staff channel read failed", { error });
    return serverError();
  }
}
