import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { WhiteboardSessionService } from "@/services/whiteboard-session.service";
import { successResponse, unauthorized, forbidden, notFound, serverError, conflict } from "@/lib/api-response";
import { z } from "zod";

type Params = { params: Promise<{ sessionId: string }> };

/** Session + participants. Host, admins, assigned tutors, the board owner, or enrolled students. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { sessionId } = await params;
    if (!z.uuid().safeParse(sessionId).success) return notFound("Live session");

    const live = await WhiteboardSessionService.findById(sessionId);
    if (!live) return notFound("Live session");
    const access = await WhiteboardSessionService.joinRole(live, session.user.id, session.user.role);
    if (!access) return notFound("Live session");

    const participants = await WhiteboardSessionService.listParticipants(sessionId);
    return successResponse({ session: live, participants, you: { userId: session.user.id, ...access } });
  } catch {
    return serverError();
  }
}

/**
 * Ends the session (host or admin). The realtime server notices within one flush interval
 * and closes the room; the in-room "End Session" button goes through the socket instead,
 * which also saves the final scene.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { sessionId } = await params;
    if (!z.uuid().safeParse(sessionId).success) return notFound("Live session");

    const live = await WhiteboardSessionService.findById(sessionId);
    if (!live || !(await WhiteboardSessionService.joinRole(live, session.user.id, session.user.role))) return notFound("Live session");
    if (live.hostId !== session.user.id && session.user.role !== "admin") return forbidden("Only the host can end this session");
    if (live.status === "ended") return conflict("This session has already ended");

    await WhiteboardSessionService.end(sessionId);
    return successResponse(null, "Live session ended");
  } catch {
    return serverError();
  }
}
