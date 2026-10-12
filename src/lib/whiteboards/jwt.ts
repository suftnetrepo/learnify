import { createHmac } from "node:crypto";

/**
 * HS256 JWTs for the realtime server (realtime/src/auth.ts verifies them with jsonwebtoken).
 * Signed with node:crypto so the Next.js app needs no JWT dependency.
 */
const TOKEN_TTL_SECONDS = 4 * 60 * 60;

export interface WhiteboardTokenPayload {
  userId:    string;
  sessionId: string;
  role:      "host" | "editor" | "viewer";
  canEdit:   boolean;
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

export function getWhiteboardJwtSecret(): string | null {
  return process.env.WHITEBOARD_JWT_SECRET || null;
}

export function signWhiteboardToken(payload: WhiteboardTokenPayload, secret: string): string {
  const now    = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body   = b64url(JSON.stringify({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS }));
  const sig    = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}
