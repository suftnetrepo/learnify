import jwt from "jsonwebtoken";
import { z } from "zod";

/**
 * Tokens are minted by the Next.js app (POST /api/whiteboards/sessions/[id]/token) with
 * HS256 and the shared WHITEBOARD_JWT_SECRET. role/canEdit in the token are informational
 * only — join re-reads both from whiteboard_participants.
 */
const payloadSchema = z.object({
  userId:    z.uuid(),
  sessionId: z.uuid(),
  role:      z.enum(["host", "editor", "viewer"]),
  canEdit:   z.boolean().optional(),
});
export type TokenPayload = z.infer<typeof payloadSchema>;

export function getJwtSecret(): string {
  const secret = process.env.WHITEBOARD_JWT_SECRET;
  if (!secret) throw new Error("WHITEBOARD_JWT_SECRET is not set");
  return secret;
}

/** Throws on a missing, malformed, badly signed or expired token. */
export function verifyToken(token: unknown): TokenPayload {
  if (typeof token !== "string" || !token) throw new Error("Missing token");
  const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
  return payloadSchema.parse(decoded);
}
