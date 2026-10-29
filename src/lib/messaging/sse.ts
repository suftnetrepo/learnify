import { onChannel } from "./notify";

const POLL_MS          = 10_000; // normal database check across instances
const MAX_BACKOFF_MS   = 60_000; // stop hammering the database during an outage
const HEARTBEAT_MS     = 20_000; // keeps proxies from closing an idle connection
const OVERLAP_MS       = 15_000; // re-read a small window; clients de-duplicate by id
const MAX_STREAM_MS    = 5 * 60_000; // recycle abandoned/proxied connections

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
      let failures = 0;
      let pollTimer: ReturnType<typeof setTimeout> | undefined;

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
          failures = 0;
        } catch {
          failures += 1;
        } finally {
          checking = false;
          if (again) { again = false; void check(); }
        }
      };

      const schedulePoll = () => {
        const delay = Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS);
        pollTimer = setTimeout(async () => {
          await check();
          if (!closed) schedulePoll();
        }, delay);
      };
      schedulePoll();

      const heartbeat   = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);
      const unsubscribe = onChannel(opts.channel, () => void check());
      const streamLimit = setTimeout(() => close(), MAX_STREAM_MS);

      const close = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearTimeout(pollTimer);
        clearInterval(heartbeat);
        clearTimeout(streamLimit);
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
