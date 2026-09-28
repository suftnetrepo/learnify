import { NextRequest } from "next/server";
import { CourseMessagingService } from "@/services";
import { channels } from "@/lib/messaging/notify";
import { pollingEventStream } from "@/lib/messaging/sse";
import { courseAccess, isUuid } from "@/lib/messaging/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/group-messages/stream?courseId=&sessionId= (SSE) — event "group_message" per message. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const courseId  = searchParams.get("courseId");
  const sessionId = searchParams.get("sessionId");
  const access = await courseAccess(courseId);
  if (!access.ok) return new Response(access.message, { status: access.status });
  if (!isUuid(sessionId)) return new Response("sessionId required", { status: 400 });
  if (!(await CourseMessagingService.sessionBelongsToCourse(sessionId, courseId!))) {
    return new Response("Not found", { status: 404 });
  }

  return pollingEventStream(req, {
    channel:   channels.groupChat(courseId!),
    connected: { courseId, sessionId },
    check: async (since) =>
      (await CourseMessagingService.groupMessagesSince(courseId!, sessionId, since))
        .map((m) => ({ event: "group_message", data: m })),
  });
}
