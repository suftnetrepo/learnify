import * as db from "./db";
import { orderedElements } from "./reconcile";
import { elementSchema, type CursorPosition, type ExcalidrawElement, type IO, type Participant, type RosterEntry } from "./types";

export interface Room {
  sessionId:     string;
  whiteboardId:  string;
  hostId:        string;
  elements:      Map<string, ExcalidrawElement>;   // elementId → latest version
  cursors:       Map<string, CursorPosition>;      // userId → last position
  participants:  Map<string, Participant>;         // userId → online participant
  globalVersion: number;
  /** appState/files from the stored scene, kept so flushes don't drop them */
  baseScene:     Pick<db.StoredScene, "appState" | "files">;
  dirty:         boolean;
  flushTimer:    NodeJS.Timeout;
  closed:        boolean;
}

const FLUSH_MS = Number(process.env.REALTIME_FLUSH_MS) || 30_000;

const rooms   = new Map<string, Room>();
const loading = new Map<string, Promise<Room>>();   // dedupe concurrent first joins

export function getRoom(sessionId: string): Room | undefined {
  return rooms.get(sessionId);
}

export function allRooms(): Room[] {
  return [...rooms.values()];
}

/** Loads the room from the whiteboard's stored scene the first time anyone joins. */
export function getOrCreateRoom(io: IO, session: db.SessionRow): Promise<Room> {
  const existing = rooms.get(session.id);
  if (existing) return Promise.resolve(existing);

  let pending = loading.get(session.id);
  if (!pending) {
    pending = (async () => {
      const scene    = await db.getWhiteboardScene(session.whiteboardId);
      const elements = new Map<string, ExcalidrawElement>();
      for (const raw of scene?.elements ?? []) {
        const parsed = elementSchema.safeParse(raw);
        if (parsed.success) elements.set(parsed.data.id, parsed.data);
      }
      const room: Room = {
        sessionId:     session.id,
        whiteboardId:  session.whiteboardId,
        hostId:        session.hostId,
        elements,
        cursors:       new Map(),
        participants:  new Map(),
        globalVersion: 0,
        baseScene:     { appState: scene?.appState, files: scene?.files },
        dirty:         false,
        closed:        false,
        flushTimer:    setInterval(() => { void periodicFlush(io, room); }, FLUSH_MS),
      };
      rooms.set(session.id, room);
      return room;
    })().finally(() => loading.delete(session.id));
    loading.set(session.id, pending);
  }
  return pending;
}

/** The room as an Excalidraw scene in the same shape the Next.js editor stores. */
export function buildScene(room: Room): db.StoredScene {
  return {
    type:     "excalidraw",
    version:  2,
    source:   "edquis-realtime",
    elements: orderedElements(room.elements),
    appState: room.baseScene.appState ?? {},
    files:    room.baseScene.files ?? {},
  };
}

export function roster(room: Room): RosterEntry[] {
  return [...room.participants.values()].map(({ userId, name, role, canEdit, color }) => ({ userId, name, role, canEdit, color }));
}

/** Writes the scene to whiteboards.scene_data and takes a periodic snapshot, if anything changed. */
export async function flushRoom(room: Room, trigger: "periodic" | "session_end" = "periodic"): Promise<db.StoredScene> {
  const scene = buildScene(room);
  if (!room.dirty && trigger === "periodic") return scene;
  room.dirty = false;
  try {
    const version = await db.saveWhiteboardScene(room.whiteboardId, scene);
    if (version !== null) await db.saveSnapshot(room.whiteboardId, scene, trigger, version);
  } catch (err) {
    room.dirty = true;   // retry on the next tick
    console.error(`[realtime] flush failed for session ${room.sessionId}`, err);
  }
  return scene;
}

/**
 * Every FLUSH_MS: persist changes, and pick up anything changed through the Next.js API
 * while the room is open — a session ended via DELETE, or canEdit set via the participants PATCH.
 */
async function periodicFlush(io: IO, room: Room) {
  if (room.closed) return;
  await flushRoom(room);
  try {
    const session = await db.getSession(room.sessionId);
    if (!session || session.status === "ended") {
      io.to(room.sessionId).emit("session:ended");
      closeRoom(io, room);
      return;
    }
    const permissions = await db.getPermissions(room.sessionId);
    for (const participant of room.participants.values()) {
      const canEdit = permissions.get(participant.userId);
      if (canEdit !== undefined && canEdit !== participant.canEdit && participant.role !== "host") {
        participant.canEdit = canEdit;
        io.to(room.sessionId).emit("permission:changed", { userId: participant.userId, canEdit });
      }
    }
  } catch (err) {
    console.error(`[realtime] refresh failed for session ${room.sessionId}`, err);
  }
}

/** Stops the flush timer, drops the room and disconnects its sockets. Callers flush first if needed. */
export function closeRoom(io: IO, room: Room) {
  if (room.closed) return;
  room.closed = true;
  clearInterval(room.flushTimer);
  rooms.delete(room.sessionId);
  io.in(room.sessionId).disconnectSockets(true);
}

const CURSOR_COLORS = ["#4f46e5", "#db2777", "#059669", "#d97706", "#0891b2", "#7c3aed", "#dc2626", "#65a30d"];

/** Stable per-user cursor colour. */
export function colorFor(userId: string): string {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}
