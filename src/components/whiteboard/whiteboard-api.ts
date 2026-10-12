/**
 * Client calls for /api/whiteboards. Kept beside the whiteboard components (rather than in
 * lib/api-client) but uses the same envelope and ApiError, so callers handle errors the same way.
 */
import { ApiError } from "@/lib/api-client";
import type { StoredScene } from "./ExcalidrawCanvas";

export interface WhiteboardSummaryDTO {
  id:          string;
  title:       string;
  mode:        "individual" | "classroom";
  courseId:    string | null;
  courseTitle: string | null;
  lectureId:   string | null;
  version:     number;
  createdAt:   string;
  updatedAt:   string;
}

export interface WhiteboardDTO extends Omit<WhiteboardSummaryDTO, "courseTitle"> {
  ownerId:     string;
  sceneData:   StoredScene | null;
  courseTitle?: string | null;
}

interface Envelope<T> { success: boolean; message: string; data: T; code?: string; errors?: Record<string, string[]> }

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(`Server error (${res.status})`, res.status);
  }
  const json = (await res.json()) as Envelope<T>;
  if (!json.success) throw new ApiError(json.message ?? "Something went wrong", res.status, json.code, json.errors);
  return json.data;
}

const send = <T>(method: string, url: string, body?: unknown) =>
  call<T>(url, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const whiteboardsApi = {
  list:      (courseId?: string) =>
    call<WhiteboardSummaryDTO[]>(`/api/whiteboards${courseId ? `?courseId=${encodeURIComponent(courseId)}` : ""}`),
  create:    (body: { title: string; courseId?: string | null; lectureId?: string | null }) =>
    send<WhiteboardDTO>("POST", "/api/whiteboards", body),
  get:       (id: string) =>
    call<{ whiteboard: WhiteboardDTO; canEdit: boolean }>(`/api/whiteboards/${id}`),
  update:    (id: string, body: { version: number; title?: string; courseId?: string | null; lectureId?: string | null; sceneData?: StoredScene | null }) =>
    send<{ whiteboard: WhiteboardDTO; version: number }>("PATCH", `/api/whiteboards/${id}`, body),
  remove:    (id: string) => send<null>("DELETE", `/api/whiteboards/${id}`),
  duplicate: (id: string) => send<WhiteboardDTO>("POST", `/api/whiteboards/${id}/duplicate`),
  snapshot:  (id: string, sceneData: StoredScene, trigger: "periodic" | "manual") =>
    send<{ id: string }>("POST", `/api/whiteboards/${id}/snapshot`, { sceneData, trigger }),
};

/** The server's current version from a 409 response (sent in errors.version). */
export function conflictVersion(err: unknown): number | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const v = Number(err.errors?.version?.[0]);
  return Number.isFinite(v) ? v : null;
}
