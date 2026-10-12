import * as db from "../db";
import { getRoom, flushRoom, closeRoom } from "../rooms";
import { emitError, type ClientSocket, type IO } from "../types";

/**
 * Host only: saves the final scene to the session row and the whiteboard, takes a
 * session_end snapshot, tells everyone, then closes the room.
 */
export async function handleSessionEnd(io: IO, socket: ClientSocket) {
  const { userId, sessionId } = socket.data;
  const room = getRoom(sessionId);
  if (!room || room.hostId !== userId || room.participants.get(userId)?.socketId !== socket.id) {
    emitError(socket, "FORBIDDEN", "Only the host can end the session");
    return;
  }

  try {
    const scene = await flushRoom(room, "session_end");   // whiteboards.scene_data + snapshot
    await db.endSession(sessionId, scene);                 // final_scene_data, status='ended'
    io.to(sessionId).emit("session:ended");
    closeRoom(io, room);
  } catch (err) {
    console.error("[realtime] session:end failed", err);
    emitError(socket, "END_FAILED", "Couldn't end the session — try again");
  }
}
