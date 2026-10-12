import { z } from "zod";
import * as db from "../db";
import { getRoom } from "../rooms";
import { emitError, type ClientSocket, type IO } from "../types";

const permissionSchema = z.object({
  userId:  z.uuid(),
  canEdit: z.boolean(),
});

/** Host only. Persists to whiteboard_participants first so the change survives a reconnect. */
export async function handlePermissionSet(io: IO, socket: ClientSocket, payload: unknown) {
  const { userId, sessionId } = socket.data;
  const room = getRoom(sessionId);
  if (!room || room.hostId !== userId || room.participants.get(userId)?.socketId !== socket.id) {
    emitError(socket, "FORBIDDEN", "Only the host can change drawing access");
    return;
  }

  const parsed = permissionSchema.safeParse(payload);
  if (!parsed.success) {
    emitError(socket, "INVALID_PERMISSION", "Permission change was malformed");
    return;
  }
  const { userId: targetId, canEdit } = parsed.data;
  if (targetId === room.hostId) {
    emitError(socket, "INVALID_PERMISSION", "The host always has drawing access");
    return;
  }

  try {
    const updated = await db.setCanEdit(sessionId, targetId, canEdit);
    if (!updated) {
      emitError(socket, "NOT_A_PARTICIPANT", "That user isn't in this session");
      return;
    }
    const target = room.participants.get(targetId);
    if (target) target.canEdit = canEdit;
    io.to(sessionId).emit("permission:changed", { userId: targetId, canEdit });
  } catch (err) {
    console.error("[realtime] permission:set failed", err);
    emitError(socket, "PERMISSION_FAILED", "Couldn't update drawing access");
  }
}
