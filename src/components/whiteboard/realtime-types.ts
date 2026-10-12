/**
 * Socket.IO event contract with the realtime server. Mirrors realtime/src/types.ts — the
 * realtime package is built separately, so keep the two in sync by hand.
 */
import type { OrderedExcalidrawElement } from "./ExcalidrawCanvas";

export type ParticipantRole = "host" | "editor" | "viewer";

export interface RosterEntry { userId: string; name: string; role: ParticipantRole; canEdit: boolean; color: string }

export interface RoomState {
  sessionId:     string;
  whiteboardId:  string;
  hostId:        string;
  elements:      OrderedExcalidrawElement[];
  participants:  RosterEntry[];
  you:           { userId: string; role: ParticipantRole; canEdit: boolean };
  globalVersion: number;
}

export interface ServerToClientEvents {
  "room:state":         (state: RoomState) => void;
  "elements:patch":     (payload: { elements: OrderedExcalidrawElement[]; globalVersion: number }) => void;
  "participant:joined": (participant: RosterEntry) => void;
  "participant:left":   (payload: { userId: string }) => void;
  "cursor:moved":       (payload: { userId: string; x: number; y: number; name: string; color: string }) => void;
  "permission:changed": (payload: { userId: string; canEdit: boolean }) => void;
  "session:ended":      () => void;
  error:                (payload: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  join:              () => void;
  "elements:update": (payload: { elements: readonly OrderedExcalidrawElement[] }) => void;
  "cursor:move":     (payload: { x: number; y: number }) => void;
  "permission:set":  (payload: { userId: string; canEdit: boolean }) => void;
  "session:end":     () => void;
}
