import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { MessagingService } from "@/services";
import type { Viewer } from "@/services/messaging.service";
import { onConversationChange } from "@/lib/messaging/notify";

// SSE needs the Node.js runtime and must never be cached
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS      = 2000;    // database check — delivery across instances/serverless
const HEARTBEAT_MS = 20000;   // keeps proxies from closing an idle connection
const OVERLAP_MS   = 5000;    // re-read a small window; the client de-duplicates by id

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

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let since  = new Date(Date.now() - OVERLAP_MS);
      let checking = false;
      let again    = false;

      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { close(); }
      };
      const event = (name: string, data: unknown) => send(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

      const check = async () => {
        if (closed) return;
        if (checking) { again = true; return; }   // coalesce bursts
        checking = true;
        try {
          const now = new Date();
          const [fresh, read] = await Promise.all([
            MessagingService.messagesSince(conversationId, since),
            MessagingService.readSince(conversationId, viewer.id, since),
          ]);
          fresh.forEach((m) => event("message", m));
          if (read.length) event("read", { ids: read.map((r) => r.id), readAt: read[0].readAt });
          since = new Date(now.getTime() - OVERLAP_MS);
        } catch {
          /* transient DB error — try again next tick */
        } finally {
          checking = false;
          if (again) { again = false; void check(); }
        }
      };

      const poll      = setInterval(check, POLL_MS);
      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);
      const unsubscribe = onConversationChange(conversationId, () => void check());

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(poll);
        clearInterval(heartbeat);
        unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      };
      cleanup = close;
      req.signal.addEventListener("abort", close);

      send(`retry: 3000\n\n`);
      event("connected", { conversationId });
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream; charset=utf-8",
      "Cache-Control":     "no-cache, no-transform",
      Connection:          "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
