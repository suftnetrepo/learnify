import type { NextRequest, NextResponse } from "next/server";
import { errorResponse, validationError } from "@/lib/api-response";

const DEFAULT_MAX_SCENE_BYTES = 10 * 1024 * 1024;   // 10 MB

export function maxSceneBytes(): number {
  const configured = Number(process.env.WHITEBOARD_MAX_SCENE_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_SCENE_BYTES;
}

const tooLarge = () =>
  errorResponse(`Whiteboard is too large (limit ${Math.round(maxSceneBytes() / 1024 / 1024)} MB)`, "PAYLOAD_TOO_LARGE", 413);

type BodyResult = { ok: true; body: unknown } | { ok: false; response: NextResponse };

/**
 * Reads a JSON body, rejecting it before parsing when it's over the scene size limit.
 * The whole body is measured (not just sceneData) so an oversized scene can't be
 * parsed into memory first. Small allowance on top for the other fields.
 */
export async function readWhiteboardBody(req: NextRequest): Promise<BodyResult> {
  const limit         = maxSceneBytes() + 64 * 1024;
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > limit) return { ok: false, response: tooLarge() };

  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > limit) return { ok: false, response: tooLarge() };

  try {
    return { ok: true, body: text ? JSON.parse(text) : {} };
  } catch {
    return { ok: false, response: validationError({ body: ["Request body must be valid JSON"] }) };
  }
}

/** Exact limit check on the scene itself, once parsed. */
export function sceneTooLarge(sceneData: unknown): NextResponse | null {
  if (sceneData === undefined || sceneData === null) return null;
  return Buffer.byteLength(JSON.stringify(sceneData), "utf8") > maxSceneBytes() ? tooLarge() : null;
}

export const fieldErrors = (errors: Record<string, string[] | undefined>) =>
  validationError(Object.fromEntries(Object.entries(errors).filter((e): e is [string, string[]] => !!e[1])));
