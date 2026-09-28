import { NextRequest } from "next/server";
import { CourseMessagingService } from "@/services";
import { channels } from "@/lib/messaging/notify";
import { pollingEventStream } from "@/lib/messaging/sse";
import { courseAccess } from "@/lib/messaging/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/announcements/stream?courseId= (SSE) — event "announcement" for each new notice. */
export async function GET(req: NextRequest) {
  const courseId = new URL(req.url).searchParams.get("courseId");
  const access = await courseAccess(courseId);
  if (!access.ok) return new Response(access.message, { status: access.status });

  return pollingEventStream(req, {
    channel:   channels.announcements(courseId!),
    connected: { courseId },
    check: async (since) =>
      (await CourseMessagingService.announcementsSince(courseId!, since))
        .map((a) => ({ event: "announcement", data: a })),
  });
}
