import type { Server, Socket } from "socket.io";
import { z } from "zod";

/**
 * The server only needs an element's identity and version fields to reconcile it — the
 * rest of the Excalidraw element passes through untouched (looseObject keeps it).
 */
export const elementSchema = z.looseObject({
  id:           z.string().min(1).max(100),
  version:      z.number().int().nonnegative(),
  versionNonce: z.number().int(),
  isDeleted:    z.boolean(),
  index:        z.string().nullish(),   // fractional z-order index (Excalidraw ≥ 0.17)
});
export type ExcalidrawElement = z.infer<typeof elementSchema>;

export type ParticipantRole = "host" | "editor" | "viewer";

export interface CursorPosition { x: number; y: number; name: string; color: string }

export interface Participant {
  userId:   string;
  name:     string;
  role:     ParticipantRole;
  canEdit:  boolean;
  socketId: string;
  color:    string;
}

export interface RosterEntry { userId: string; name: string; role: ParticipantRole; canEdit: boolean; color: string }

export interface ErrorPayload { code: string; message: string }

export interface ServerToClientEvents {
  "room:state": (state: {
    sessionId:     string;
    whiteboardId:  string;
    hostId:        string;
    elements:      ExcalidrawElement[];
    participants:  RosterEntry[];
    you:           { userId: string; role: ParticipantRole; canEdit: boolean };
    globalVersion: number;
  }) => void;
  "elements:patch":     (payload: { elements: ExcalidrawElement[]; globalVersion: number }) => void;
  "participant:joined": (participant: RosterEntry) => void;
  "participant:left":   (payload: { userId: string }) => void;
  "cursor:moved":       (payload: { userId: string } & CursorPosition) => void;
  "permission:changed": (payload: { userId: string; canEdit: boolean }) => void;
  "session:ended":      () => void;
  error:                (payload: ErrorPayload) => void;
}

export interface ClientToServerEvents {
  join:              () => void;
  "elements:update": (payload: unknown) => void;
  "cursor:move":     (payload: unknown) => void;
  "permission:set":  (payload: unknown) => void;
  "session:end":     () => void;
}

/** Set by the auth middleware from the verified token — never from client payloads. */
export interface SocketData { userId: string; sessionId: string }

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type IO           = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export function emitError(socket: ClientSocket, code: string, message: string) {
  socket.emit("error", { code, message });
}
