import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { WhiteboardSessionService } from "@/services/whiteboard-session.service";
import { successResponse, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { fieldErrors } from "@/lib/whiteboards/api";
import { z } from "zod";

type Params = { params: Promise<{ sessionId: string }> };

const patchSchema = z.object({
  userId:  z.uuid(),
  canEdit: z.boolean(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { sessionId } = await params;
    if (!z.uuid().safeParse(sessionId).success) return notFound("Live session");

    const live = await WhiteboardSessionService.findById(sessionId);
    if (!live || !(await WhiteboardSessionService.joinRole(live, session.user.id, session.user.role))) return notFound("Live session");

    return successResponse(await WhiteboardSessionService.listParticipants(sessionId));
  } catch {
    return serverError();
  }
}

/**
 * Host or admin: grant/revoke drawing. Open rooms pick this up on their next flush
 * (≤ 30 s); the in-room toggle uses the socket's permission:set for an instant change.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { sessionId } = await params;
    if (!z.uuid().safeParse(sessionId).success) return notFound("Live session");

    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fieldErrors(parsed.error.flatten().fieldErrors);

    const live = await WhiteboardSessionService.findById(sessionId);
    if (!live || !(await WhiteboardSessionService.joinRole(live, session.user.id, session.user.role))) return notFound("Live session");
    if (live.hostId !== session.user.id && session.user.role !== "admin") return forbidden("Only the host can change drawing access");

    const updated = await WhiteboardSessionService.setCanEdit(sessionId, parsed.data.userId, parsed.data.canEdit);
    if (!updated) return notFound("Participant");
    return successResponse(parsed.data, "Drawing access updated");
  } catch {
    return serverError();
  }
}
