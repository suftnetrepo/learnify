import { onChannel } from "./notify";

const POLL_MS      = 2000;    // database check — delivery across instances/serverless
const HEARTBEAT_MS = 20000;   // keeps proxies from closing an idle connection
const OVERLAP_MS   = 5000;    // re-read a small window; clients de-duplicate by id

export interface SseEvent { event: string; data: unknown }

/**
 * A Server-Sent Events response that re-checks the database every couple of seconds and
 * immediately when `channel` is notified in this process. `check(since)` returns the events
 * that happened at/after `since` (it overlaps the previous window, so clients must de-duplicate).
 * Sends a `connected` event first — clients reload on it to catch up after (re)connecting.
 */
export function pollingEventStream(
  req: Request,
  opts: { channel: string; connected: unknown; check: (since: Date) => Promise<SseEvent[]> },
): Response {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed   = false;
      let since    = new Date(Date.now() - OVERLAP_MS);
      let checking = false;
      let again    = false;

      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { close(); }
      };
      const emit = ({ event, data }: SseEvent) => send(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

      const check = async () => {
        if (closed) return;
        if (checking) { again = true; return; }   // coalesce bursts
        checking = true;
        try {
          const now = new Date();
          (await opts.check(since)).forEach(emit);
          since = new Date(now.getTime() - OVERLAP_MS);
        } catch {
          /* transient DB error — try again next tick */
        } finally {
          checking = false;
          if (again) { again = false; void check(); }
        }
      };

      const poll        = setInterval(check, POLL_MS);
      const heartbeat   = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);
      const unsubscribe = onChannel(opts.channel, () => void check());

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
      emit({ event: "connected", data: opts.connected });
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
