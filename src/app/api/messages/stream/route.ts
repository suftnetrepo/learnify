import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { MessagingService } from "@/services";
import type { Viewer } from "@/services/messaging.service";
import { channels } from "@/lib/messaging/notify";
import { pollingEventStream, type SseEvent } from "@/lib/messaging/sse";

// SSE needs the Node.js runtime and must never be cached
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/messages/stream?conversationId=…  (Server-Sent Events)
 *   event "message" — a message (new, or re-sent within the overlap window)
 *   event "read"    — { ids, readAt }: the viewer's messages were read by the other side
 * Browsers reconnect EventSource automatically; the client reloads the thread on (re)connect.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorised", { status: 401 });
  const viewer: Viewer = { id: session.user.id, role: session.user.role };

  const conversationId = new URL(req.url).searchParams.get("conversationId") ?? "";
  if (!z.string().uuid().safeParse(conversationId).success) return new Response("conversationId required", { status: 400 });
  const conversation = await MessagingService.get(conversationId);
  if (!conversation) return new Response("Not found", { status: 404 });
  if (!(await MessagingService.canRead(viewer, conversation))) return new Response("Forbidden", { status: 403 });

  return pollingEventStream(req, {
    channel:   channels.conversation(conversationId),
    connected: { conversationId },
    check: async (since) => {
      const [fresh, read] = await Promise.all([
        MessagingService.messagesSince(conversationId, since),
        MessagingService.readSince(conversationId, viewer.id, since),
      ]);
      const events: SseEvent[] = fresh.map((m) => ({ event: "message", data: m }));
      if (read.length) events.push({ event: "read", data: { ids: read.map((r) => r.id), readAt: read[0].readAt } });
      return events;
    },
  });
}
