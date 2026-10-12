import { createServer } from "node:http";
import { Server } from "socket.io";
import { verifyToken, getJwtSecret } from "./auth";
import * as db from "./db";
import { getRoom, allRooms, flushRoom, closeRoom } from "./rooms";
import { handleJoin } from "./handlers/join";
import { handleElementsUpdate } from "./handlers/draw";
import { handleCursorMove, clearCursorThrottle } from "./handlers/cursor";
import { handlePermissionSet } from "./handlers/permission";
import { handleSessionEnd } from "./handlers/end";
import type { ClientToServerEvents, ServerToClientEvents, SocketData, IO } from "./types";

getJwtSecret();   // fail fast at boot rather than on the first connection

const PORT              = Number(process.env.REALTIME_PORT ?? process.env.PORT) || 4000;
const EMPTY_ROOM_GRACE  = Number(process.env.REALTIME_EMPTY_ROOM_GRACE_MS) || 60_000;
const ALLOWED_ORIGINS   = (process.env.REALTIME_CORS_ORIGIN ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  .split(",").map((o) => o.trim()).filter(Boolean);

const httpServer = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: allRooms().length }));
    return;
  }
  res.writeHead(404).end();
});

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const io: IO = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(httpServer, {
  cors:              { origin: ALLOWED_ORIGINS, credentials: true },
  maxHttpBufferSize: 5 * 1024 * 1024,   // one elements:update; full scenes are never sent client → server
});

// ─── Auth: verify the token and that its session exists and is still active ─────
io.use(async (socket, next) => {
  try {
    const payload = verifyToken(socket.handshake.auth?.token);
    const session = await db.getSession(payload.sessionId);
    if (!session)                    return next(new Error("SESSION_NOT_FOUND"));
    if (session.status !== "active") return next(new Error("SESSION_ENDED"));
    socket.data = { userId: payload.userId, sessionId: payload.sessionId };
    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
});

io.on("connection", (socket) => {
  socket.on("join",            () => { void handleJoin(io, socket); });
  socket.on("elements:update", (payload) => handleElementsUpdate(socket, payload));
  socket.on("cursor:move",     (payload) => handleCursorMove(socket, payload));
  socket.on("permission:set",  (payload) => { void handlePermissionSet(io, socket, payload); });
  socket.on("session:end",     () => { void handleSessionEnd(io, socket); });

  socket.on("disconnect", () => {
    clearCursorThrottle(socket.id);
    const { userId, sessionId } = socket.data;
    const room = getRoom(sessionId);
    const participant = room?.participants.get(userId);
    // Only if this socket still holds the seat — a newer tab may have replaced it
    if (!room || !participant || participant.socketId !== socket.id) return;

    room.participants.delete(userId);
    room.cursors.delete(userId);
    io.to(sessionId).emit("participant:left", { userId });
    void db.touchParticipant(sessionId, userId).catch(() => {});

    // Keep an empty room briefly so a reconnect doesn't reload from the DB
    if (room.participants.size === 0) {
      setTimeout(async () => {
        if (room.closed || room.participants.size > 0) return;
        await flushRoom(room);
        closeRoom(io, room);
      }, EMPTY_ROOM_GRACE);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[realtime] listening on :${PORT} (CORS: ${ALLOWED_ORIGINS.join(", ")})`);
});

// ─── Graceful shutdown: persist every open room before exiting (deploys/restarts) ─
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[realtime] ${signal} — flushing ${allRooms().length} room(s)`);
  for (const room of allRooms()) {
    await flushRoom(room);
    closeRoom(io, room);
  }
  io.close();
  await db.pool.end().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT",  () => { void shutdown("SIGINT"); });
