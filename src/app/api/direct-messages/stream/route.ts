import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { DirectMessagingService } from "@/services";
import type { Viewer } from "@/services/messaging.service";
import { channels } from "@/lib/messaging/notify";
import { pollingEventStream, type SseEvent } from "@/lib/messaging/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/direct-messages/stream?conversationId=… (SSE) — same events as the private stream:
 * "message" for each message, "read" { ids, readAt } when the other side reads the viewer's.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorised", { status: 401 });
  const viewer: Viewer = { id: session.user.id, role: session.user.role };

  const threadId = new URL(req.url).searchParams.get("conversationId") ?? "";
  if (!z.string().uuid().safeParse(threadId).success) return new Response("conversationId required", { status: 400 });
  const thread = await DirectMessagingService.get(threadId);
  if (!thread) return new Response("Not found", { status: 404 });
  if (!DirectMessagingService.canRead(viewer, thread)) return new Response("Forbidden", { status: 403 });

  return pollingEventStream(req, {
    channel:   channels.direct(threadId),
    connected: { conversationId: threadId },
    check: async (since) => {
      const [fresh, read] = await Promise.all([
        DirectMessagingService.messagesSince(threadId, since),
        DirectMessagingService.readSince(threadId, viewer.id, since),
      ]);
      const events: SseEvent[] = fresh.map((m) => ({ event: "message", data: m }));
      if (read.length) events.push({ event: "read", data: { ids: read.map((r) => r.id), readAt: read[0].readAt } });
      return events;
    },
  });
}
