import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { MessagingService, MessagingError } from "@/services";
import type { Viewer } from "@/services/messaging.service";
import { MAX_MESSAGE_LENGTH } from "@/services/messaging.service";
import {
  createdResponse, errorResponse, serverError, successResponse, unauthorized, validationError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

/**
 * GET /api/messages[?courseId=][&unread=1]
 *   Conversations the user can see (students: their own; tutors: their courses; admins: all),
 *   or with unread=1 just { unread } for badges.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const viewer: Viewer = { id: session.user.id, role: session.user.role };
    const { searchParams } = new URL(req.url);

    if (searchParams.get("unread") === "1") {
      return successResponse({ unread: await MessagingService.unreadTotal(viewer) });
    }
    const courseId = searchParams.get("courseId") ?? undefined;
    if (courseId && !z.string().uuid().safeParse(courseId).success) {
      return validationError({ courseId: ["Invalid course id"] });
    }
    return successResponse(await MessagingService.list(viewer, courseId));
  } catch (error) {
    log.error("List conversations failed", { error });
    return serverError();
  }
}

const sendSchema = z.object({
  courseId:       z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  content:        z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

/** POST /api/messages { content, courseId? (student's first message) | conversationId? } */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const parsed = sendSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const result = await MessagingService.send({ id: session.user.id, role: session.user.role }, parsed.data);
    return createdResponse(result, "Message sent");
  } catch (error) {
    if (error instanceof MessagingError) return errorResponse(error.message, "MESSAGING_ERROR", error.status);
    log.error("Send message failed", { error });
    return serverError();
  }
}
