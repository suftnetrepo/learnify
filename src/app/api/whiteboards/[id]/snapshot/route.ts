import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { WhiteboardService, WHITEBOARD_TRIGGERS } from "@/services/whiteboard.service";
import { createdResponse, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { readWhiteboardBody, sceneTooLarge, fieldErrors } from "@/lib/whiteboards/api";
import { z } from "zod";

const snapshotSchema = z.object({
  sceneData: z.record(z.string(), z.unknown()),
  trigger:   z.enum(WHITEBOARD_TRIGGERS).default("manual"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return notFound("Whiteboard");

    const read = await readWhiteboardBody(req);
    if (!read.ok) return read.response;

    const parsed = snapshotSchema.safeParse(read.body);
    if (!parsed.success) return fieldErrors(parsed.error.flatten().fieldErrors);

    const oversize = sceneTooLarge(parsed.data.sceneData);
    if (oversize) return oversize;

    const board = await WhiteboardService.findById(id);
    if (!board || !WhiteboardService.canRead(board, session.user.id, session.user.role)) return notFound("Whiteboard");
    if (board.ownerId !== session.user.id) return forbidden("Only the owner can save snapshots");

    const snapshot = await WhiteboardService.saveSnapshot(
      id, parsed.data.sceneData, parsed.data.trigger, board.version,
    );
    return createdResponse(snapshot, "Snapshot saved");
  } catch {
    return serverError();
  }
}
