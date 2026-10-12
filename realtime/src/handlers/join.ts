import * as db from "../db";
import { getOrCreateRoom, roster, colorFor } from "../rooms";
import { orderedElements } from "../reconcile";
import { emitError, type ClientSocket, type IO } from "../types";

/**
 * Adds the socket to its session's room. Role and canEdit come from whiteboard_participants
 * (written by the Next.js token route), never from the token or the client. Also handles
 * reconnects: the same user rejoining just gets the current server-authoritative state.
 */
export async function handleJoin(io: IO, socket: ClientSocket) {
  const { userId, sessionId } = socket.data;
  try {
    const session = await db.getSession(sessionId);
    if (!session || session.status !== "active") {
      emitError(socket, "SESSION_ENDED", "This live session has ended");
      socket.disconnect(true);
      return;
    }

    const row = await db.getParticipant(sessionId, userId);
    if (!row) {
      emitError(socket, "NOT_A_PARTICIPANT", "You haven't been admitted to this session");
      socket.disconnect(true);
      return;
    }

    const room       = await getOrCreateRoom(io, session);
    const wasOnline  = room.participants.has(userId);
    const previous   = room.participants.get(userId);
    const isHost     = row.role === "host" && session.hostId === userId;
    const participant = {
      userId,
      name:     row.name ?? "Participant",
      role:     row.role,
      canEdit:  isHost || row.canEdit,
      socketId: socket.id,
      color:    colorFor(userId),
    };
    room.participants.set(userId, participant);

    // A second tab replaces the first — the old socket would otherwise keep a stale seat
    if (previous && previous.socketId !== socket.id) {
      io.sockets.sockets.get(previous.socketId)?.disconnect(true);
    }

    await socket.join(sessionId);
    socket.emit("room:state", {
      sessionId,
      whiteboardId:  room.whiteboardId,
      hostId:        room.hostId,
      elements:      orderedElements(room.elements),
      participants:  roster(room),
      you:           { userId, role: participant.role, canEdit: participant.canEdit },
      globalVersion: room.globalVersion,
    });

    if (!wasOnline) {
      const { name, role, canEdit, color } = participant;
      socket.to(sessionId).emit("participant:joined", { userId, name, role, canEdit, color });
    }
    void db.touchParticipant(sessionId, userId).catch(() => {});
  } catch (err) {
    console.error("[realtime] join failed", err);
    emitError(socket, "JOIN_FAILED", "Couldn't join the session");
  }
}
