import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// db.ts opens a pg pool at import — replace the whole module; nothing here touches Postgres
vi.mock("../db", () => ({
  getSession:         vi.fn(),
  getWhiteboardScene: vi.fn(),
  getParticipant:     vi.fn(),
  getPermissions:     vi.fn(),
  setCanEdit:         vi.fn(),
  touchParticipant:   vi.fn(async () => {}),
  saveWhiteboardScene: vi.fn(),
  saveSnapshot:       vi.fn(),
  endSession:         vi.fn(),
}));

import * as db from "../db";
import { getOrCreateRoom, getRoom, allRooms, closeRoom } from "../rooms";
import { handleJoin } from "../handlers/join";
import { handlePermissionSet } from "../handlers/permission";
import type { ClientSocket, IO } from "../types";

// permission:set validates user ids as UUIDs, so the fixtures use real ones
const HOST    = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STUDENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SESSION = { id: "22222222-2222-4222-8222-222222222222", whiteboardId: "wb-1", hostId: HOST, status: "active" as const };

function fakeIo() {
  const broadcast = vi.fn();
  return {
    io: {
      sockets: { sockets: new Map() },
      to: vi.fn(() => ({ emit: broadcast })),
      in: vi.fn(() => ({ disconnectSockets: vi.fn() })),
    } as unknown as IO,
    broadcast,
  };
}

function fakeSocket(userId: string, id = `sock-${userId}`) {
  const toEmit = vi.fn();
  const socket = {
    id,
    data:       { userId, sessionId: SESSION.id },
    emit:       vi.fn(),
    join:       vi.fn(async () => {}),
    to:         vi.fn(() => ({ emit: toEmit })),
    disconnect: vi.fn(),
  };
  return { socket: socket as unknown as ClientSocket, raw: socket, toEmit };
}

describe("rooms", () => {
  beforeEach(() => {
    vi.useFakeTimers();   // rooms start a 30 s flush interval
    vi.mocked(db.getSession).mockResolvedValue(SESSION);
    vi.mocked(db.getWhiteboardScene).mockResolvedValue(null);
  });

  afterEach(() => {
    const { io } = fakeIo();
    for (const room of allRooms()) closeRoom(io, room);
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("creates a room with empty maps", async () => {
    const { io } = fakeIo();
    const room = await getOrCreateRoom(io, SESSION);
    expect(room.sessionId).toBe(SESSION.id);
    expect(room.whiteboardId).toBe("wb-1");
    expect(room.elements.size).toBe(0);
    expect(room.cursors.size).toBe(0);
    expect(room.participants.size).toBe(0);
    expect(room.globalVersion).toBe(0);
    expect(getRoom(SESSION.id)).toBe(room);
  });

  it("loads valid elements from the stored scene and skips malformed ones", async () => {
    vi.mocked(db.getWhiteboardScene).mockResolvedValue({
      elements: [
        { id: "a", version: 2, versionNonce: 1, isDeleted: false, type: "rectangle" },
        { id: "broken" },
      ],
    });
    const { io } = fakeIo();
    const room = await getOrCreateRoom(io, SESSION);
    expect([...room.elements.keys()]).toEqual(["a"]);
  });

  it("dedupes concurrent first joins into a single room", async () => {
    const { io } = fakeIo();
    const [a, b] = await Promise.all([getOrCreateRoom(io, SESSION), getOrCreateRoom(io, SESSION)]);
    expect(a).toBe(b);
    expect(db.getWhiteboardScene).toHaveBeenCalledTimes(1);
  });

  it("adds a participant with role and canEdit from the DB, not the client", async () => {
    vi.mocked(db.getParticipant).mockResolvedValue({ userId: STUDENT, name: "Sam", role: "viewer", canEdit: false });
    const { io } = fakeIo();
    const { socket, raw, toEmit } = fakeSocket(STUDENT);

    await handleJoin(io, socket);

    const participant = getRoom(SESSION.id)?.participants.get(STUDENT);
    expect(participant).toMatchObject({ role: "viewer", canEdit: false, name: "Sam", socketId: `sock-${STUDENT}` });
    expect(raw.emit).toHaveBeenCalledWith("room:state", expect.objectContaining({
      you: { userId: STUDENT, role: "viewer", canEdit: false },
    }));
    expect(toEmit).toHaveBeenCalledWith("participant:joined", expect.objectContaining({ userId: STUDENT }));
  });

  it("gives the host drawing access even if the stored flag says otherwise", async () => {
    vi.mocked(db.getParticipant).mockResolvedValue({ userId: HOST, name: "Tess", role: "host", canEdit: false });
    const { io } = fakeIo();
    await handleJoin(io, fakeSocket(HOST).socket);
    expect(getRoom(SESSION.id)?.participants.get(HOST)).toMatchObject({ role: "host", canEdit: true });
  });

  it("refuses to join someone without a participant row", async () => {
    vi.mocked(db.getParticipant).mockResolvedValue(null);
    const { io } = fakeIo();
    const { socket, raw } = fakeSocket("stranger");
    await handleJoin(io, socket);
    expect(raw.emit).toHaveBeenCalledWith("error", expect.objectContaining({ code: "NOT_A_PARTICIPANT" }));
    expect(raw.disconnect).toHaveBeenCalled();
    expect(getRoom(SESSION.id)).toBeUndefined();
  });

  it("does not let permission:set change the host's canEdit", async () => {
    vi.mocked(db.getParticipant).mockResolvedValue({ userId: HOST, name: "Tess", role: "host", canEdit: true });
    const { io, broadcast } = fakeIo();
    const host = fakeSocket(HOST);
    await handleJoin(io, host.socket);

    await handlePermissionSet(io, host.socket, { userId: HOST, canEdit: false });

    expect(host.raw.emit).toHaveBeenCalledWith("error", expect.objectContaining({ code: "INVALID_PERMISSION" }));
    expect(db.setCanEdit).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalledWith("permission:changed", expect.anything());
    expect(getRoom(SESSION.id)?.participants.get(HOST)?.canEdit).toBe(true);
  });

  it("only lets the host change permissions", async () => {
    vi.mocked(db.getParticipant).mockResolvedValue({ userId: STUDENT, name: "Sam", role: "viewer", canEdit: false });
    const { io } = fakeIo();
    const student = fakeSocket(STUDENT);
    await handleJoin(io, student.socket);

    await handlePermissionSet(io, student.socket, { userId: STUDENT, canEdit: true });

    expect(student.raw.emit).toHaveBeenCalledWith("error", expect.objectContaining({ code: "FORBIDDEN" }));
    expect(db.setCanEdit).not.toHaveBeenCalled();
  });

  it("lets the host grant a student drawing access", async () => {
    const { io, broadcast } = fakeIo();
    vi.mocked(db.getParticipant).mockResolvedValueOnce({ userId: HOST, name: "Tess", role: "host", canEdit: true });
    const host = fakeSocket(HOST);
    await handleJoin(io, host.socket);
    vi.mocked(db.getParticipant).mockResolvedValueOnce({ userId: STUDENT, name: "Sam", role: "viewer", canEdit: false });
    await handleJoin(io, fakeSocket(STUDENT).socket);
    vi.mocked(db.setCanEdit).mockResolvedValue(true);

    await handlePermissionSet(io, host.socket, { userId: STUDENT, canEdit: true });

    expect(db.setCanEdit).toHaveBeenCalledWith(SESSION.id, STUDENT, true);
    expect(getRoom(SESSION.id)?.participants.get(STUDENT)?.canEdit).toBe(true);
    expect(broadcast).toHaveBeenCalledWith("permission:changed", { userId: STUDENT, canEdit: true });
  });

  it("closeRoom stops the room and removes it", async () => {
    const { io } = fakeIo();
    const room = await getOrCreateRoom(io, SESSION);
    closeRoom(io, room);
    expect(room.closed).toBe(true);
    expect(getRoom(SESSION.id)).toBeUndefined();
    expect(allRooms()).toHaveLength(0);
  });

  // Needs a small refactor to be testable — see Milestone 4 notes:
  it.todo("removing a participant cleans up cursor and participant maps (disconnect cleanup lives inline in index.ts)");
  it.todo("getActiveRooms() only returns rooms with ≥1 participant (no such function — rooms.ts exposes allRooms())");
});
