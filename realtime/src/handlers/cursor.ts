import { z } from "zod";
import { getRoom } from "../rooms";
import type { ClientSocket } from "../types";

const THROTTLE_MS = 50;

const cursorSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

interface Throttle { lastSent: number; pending: { x: number; y: number } | null; timer: NodeJS.Timeout | null }
const throttles = new Map<string, Throttle>();   // socket.id → state

/**
 * Broadcasts at most one cursor position per user every 50 ms, always sending the latest
 * (trailing edge) so the final resting position isn't dropped. Name and colour come from the
 * room's participant record, not the client.
 */
export function handleCursorMove(socket: ClientSocket, payload: unknown) {
  const parsed = cursorSchema.safeParse(payload);
  if (!parsed.success) return;

  const { userId, sessionId } = socket.data;
  const room        = getRoom(sessionId);
  const participant = room?.participants.get(userId);
  if (!room || !participant || participant.socketId !== socket.id) return;

  const send = (pos: { x: number; y: number }) => {
    const cursor = { ...pos, name: participant.name, color: participant.color };
    room.cursors.set(userId, cursor);
    socket.to(sessionId).emit("cursor:moved", { userId, ...cursor });
  };

  let state = throttles.get(socket.id);
  if (!state) {
    state = { lastSent: 0, pending: null, timer: null };
    throttles.set(socket.id, state);
  }

  const now = Date.now();
  if (now - state.lastSent >= THROTTLE_MS) {
    state.lastSent = now;
    send(parsed.data);
    return;
  }
  state.pending = parsed.data;
  if (!state.timer) {
    const s = state;
    s.timer = setTimeout(() => {
      s.timer = null;
      if (s.pending) {
        s.lastSent = Date.now();
        send(s.pending);
        s.pending = null;
      }
    }, THROTTLE_MS - (now - state.lastSent));
  }
}

export function clearCursorThrottle(socketId: string) {
  const state = throttles.get(socketId);
  if (state?.timer) clearTimeout(state.timer);
  throttles.delete(socketId);
}
