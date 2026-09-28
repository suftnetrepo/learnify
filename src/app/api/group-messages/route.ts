import { NextRequest } from "next/server";
import { z } from "zod";
import { CourseMessagingService, MessagingError } from "@/services";
import { MAX_MESSAGE_LENGTH } from "@/services/messaging.service";
import { courseAccess, isUuid } from "@/lib/messaging/route-helpers";
import {
  createdResponse, errorResponse, notFound, serverError, successResponse, validationError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

/**
 * GET /api/group-messages?courseId=[&sessionId=] — a session's Live Q&A, oldest first.
 * Without sessionId: the session that's live now (empty when none is).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId  = searchParams.get("courseId");
    const sessionId = searchParams.get("sessionId");
    const access = await courseAccess(courseId);
    if (!access.ok) return errorResponse(access.message, "ACCESS_DENIED", access.status);

    let id: string | null = null;
    if (sessionId) {
      if (!isUuid(sessionId)) return validationError({ sessionId: ["Invalid session id"] });
      if (!(await CourseMessagingService.sessionBelongsToCourse(sessionId, courseId!))) return notFound("Session");
      id = sessionId;
    } else {
      const live = await CourseMessagingService.activeSession(
        courseId!, access.courseRole === "student" ? access.viewer.id : undefined,
      );
      id = live?.id ?? null;
    }
    return successResponse(id ? await CourseMessagingService.groupMessages(courseId!, id) : []);
  } catch (error) {
    log.error("List group messages failed", { error });
    return serverError();
  }
}

const postSchema = z.object({
  courseId:  z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  content:   z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

/** POST /api/group-messages { courseId, content, sessionId? } — only while a session is live (409 otherwise). */
export async function POST(req: NextRequest) {
  try {
    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const { courseId, sessionId, content } = parsed.data;
    const access = await courseAccess(courseId);
    if (!access.ok) return errorResponse(access.message, "ACCESS_DENIED", access.status);
    const message = await CourseMessagingService.sendGroupMessage(access.viewer, courseId, content, sessionId);
    return createdResponse(message, "Message sent");
  } catch (error) {
    if (error instanceof MessagingError) return errorResponse(error.message, "MESSAGING_ERROR", error.status);
    log.error("Send group message failed", { error });
    return serverError();
  }
}
