import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { WhiteboardSessionService } from "@/services/whiteboard-session.service";
import { signWhiteboardToken, getWhiteboardJwtSecret } from "@/lib/whiteboards/jwt";
import { successResponse, unauthorized, notFound, serverError, conflict, errorResponse } from "@/lib/api-response";
import { z } from "zod";

/**
 * Issues a 4-hour realtime token. Role is derived server-side (host → host, assigned
 * tutor/admin/owner → editor, enrolled student → viewer) and written to
 * whiteboard_participants, which is what the realtime server trusts on join.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const secret = getWhiteboardJwtSecret();
    if (!secret) return errorResponse("Live sessions aren't configured", "NOT_CONFIGURED", 503);

    const { sessionId } = await params;
    if (!z.uuid().safeParse(sessionId).success) return notFound("Live session");

    const live = await WhiteboardSessionService.findById(sessionId);
    if (!live) return notFound("Live session");
    const access = await WhiteboardSessionService.joinRole(live, session.user.id, session.user.role);
    if (!access) return notFound("Live session");
    if (live.status !== "active") return conflict("This session has ended");

    const admitted = await WhiteboardSessionService.admit(sessionId, session.user.id, access);
    const token = signWhiteboardToken({ userId: session.user.id, sessionId, ...admitted }, secret);
    return successResponse({ token });
  } catch {
    return serverError();
  }
}
