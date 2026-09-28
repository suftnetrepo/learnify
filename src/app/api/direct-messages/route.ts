import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { DirectMessagingService, MessagingError } from "@/services";
import { MAX_MESSAGE_LENGTH, type Viewer } from "@/services/messaging.service";
import {
  createdResponse, errorResponse, forbidden, serverError, successResponse, unauthorized, validationError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

/**
 * GET /api/direct-messages[?tutors=1]
 *   Tutor ↔ admin team threads (admins: all; tutors: their own) — or, for admins with
 *   tutors=1, the tutors they can start a chat with.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const viewer: Viewer = { id: session.user.id, role: session.user.role };
    if (viewer.role !== "admin" && viewer.role !== "tutor") return forbidden();
    if (new URL(req.url).searchParams.get("tutors") === "1") {
      if (viewer.role !== "admin") return forbidden();
      return successResponse(await DirectMessagingService.tutors());
    }
    return successResponse(await DirectMessagingService.list(viewer));
  } catch (error) {
    log.error("List direct threads failed", { error });
    return serverError();
  }
}

const sendSchema = z.object({
  conversationId: z.string().uuid().optional(),
  tutorId:        z.string().uuid().optional(),
  content:        z.string().min(1).max(MAX_MESSAGE_LENGTH),
});

/** POST /api/direct-messages { content, conversationId? | tutorId? (admin starting a chat) } */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const parsed = sendSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    const result = await DirectMessagingService.send({ id: session.user.id, role: session.user.role }, parsed.data);
    return createdResponse(result, "Message sent");
  } catch (error) {
    if (error instanceof MessagingError) return errorResponse(error.message, "MESSAGING_ERROR", error.status);
    log.error("Send direct message failed", { error });
    return serverError();
  }
}
