import { z } from "zod";
import { getRoom } from "../rooms";
import { reconcileElements } from "../reconcile";
import { elementSchema, emitError, type ClientSocket } from "../types";

const MAX_ELEMENTS_PER_UPDATE = 2_000;

const updateSchema = z.object({
  elements: z.array(elementSchema).min(1).max(MAX_ELEMENTS_PER_UPDATE),
});

/**
 * Client sends only changed elements. canEdit is checked against the room state (loaded from
 * the DB on join), so a viewer's updates are refused even if their client sends them.
 */
export function handleElementsUpdate(socket: ClientSocket, payload: unknown) {
  const { userId, sessionId } = socket.data;
  const room        = getRoom(sessionId);
  const participant = room?.participants.get(userId);
  if (!room || !participant || participant.socketId !== socket.id) {
    emitError(socket, "NOT_JOINED", "Join the session before drawing");
    return;
  }
  if (!participant.canEdit) {
    emitError(socket, "READ_ONLY", "You don't have drawing access in this session");
    return;
  }

  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    emitError(socket, "INVALID_ELEMENTS", "Element update was malformed");
    return;
  }

  const { accepted, rejected } = reconcileElements(room.elements, parsed.data.elements);
  if (accepted.length > 0) {
    room.globalVersion += 1;
    room.dirty = true;
    socket.to(sessionId).emit("elements:patch", { elements: accepted, globalVersion: room.globalVersion });
  }
  // Stale versions: hand the sender the server's copy so it converges
  if (rejected.length > 0) {
    socket.emit("elements:patch", { elements: rejected, globalVersion: room.globalVersion });
  }
}
