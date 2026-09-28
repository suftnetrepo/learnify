import { NextRequest } from "next/server";
import { CourseMessagingService } from "@/services";
import { channels } from "@/lib/messaging/notify";
import { pollingEventStream } from "@/lib/messaging/sse";
import { staffAccess } from "@/lib/messaging/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/staff-messages/stream?courseId= (SSE) — event "staff_message" per message. */
export async function GET(req: NextRequest) {
  const courseId = new URL(req.url).searchParams.get("courseId");
  const access = await staffAccess(courseId);
  if (!access.ok) return new Response(access.message, { status: access.status });

  return pollingEventStream(req, {
    channel:   channels.staff(courseId!),
    connected: { courseId },
    check: async (since) =>
      (await CourseMessagingService.staffMessagesSince(courseId!, since))
        .map((m) => ({ event: "staff_message", data: m })),
  });
}
