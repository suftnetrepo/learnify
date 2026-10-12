import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { WhiteboardService, ConflictError } from "@/services/whiteboard.service";
import {
  successResponse, unauthorized, forbidden, notFound, serverError, errorResponse,
} from "@/lib/api-response";
import { readWhiteboardBody, sceneTooLarge, fieldErrors } from "@/lib/whiteboards/api";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  version:   z.number().int().positive(),
  title:     z.string().trim().min(1).max(200).optional(),
  courseId:  z.uuid().nullable().optional(),
  lectureId: z.uuid().nullable().optional(),
  sceneData: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return notFound("Whiteboard");

    const board = await WhiteboardService.findById(id);
    if (!board) return notFound("Whiteboard");
    if (!WhiteboardService.canRead(board, session.user.id, session.user.role)) return notFound("Whiteboard");

    const canEdit = await WhiteboardService.canModify(board, session.user.id, session.user.role);
    return successResponse({ whiteboard: board, canEdit });
  } catch {
    return serverError();
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return notFound("Whiteboard");

    const read = await readWhiteboardBody(req);
    if (!read.ok) return read.response;

    const parsed = patchSchema.safeParse(read.body);
    if (!parsed.success) return fieldErrors(parsed.error.flatten().fieldErrors);
    const { version, ...changes } = parsed.data;

    const oversize = sceneTooLarge(changes.sceneData);
    if (oversize) return oversize;

    const board = await WhiteboardService.findById(id);
    if (!board || !WhiteboardService.canRead(board, session.user.id, session.user.role)) return notFound("Whiteboard");
    if (!(await WhiteboardService.canModify(board, session.user.id, session.user.role))) return forbidden();

    // Validate the association that will result, so a lecture can't be left pointing at another course
    if (changes.courseId !== undefined || changes.lectureId !== undefined) {
      const courseId  = changes.courseId  !== undefined ? changes.courseId  : board.courseId;
      const lectureId = changes.lectureId !== undefined ? changes.lectureId
        : changes.courseId !== undefined && changes.courseId !== board.courseId ? null   // course changed → drop stale lecture
        : board.lectureId;
      const associationError = await WhiteboardService.checkAssociation(
        session.user.id, session.user.role, courseId, lectureId,
      );
      if (associationError) return forbidden(associationError);
      changes.courseId  = courseId;
      changes.lectureId = lectureId;
    }

    const updated = await WhiteboardService.update(id, changes, version);
    if (!updated) return notFound("Whiteboard");
    return successResponse({ whiteboard: updated, version: updated.version }, "Whiteboard saved");
  } catch (err) {
    if (err instanceof ConflictError) {
      return errorResponse(err.message, "CONFLICT", 409, { version: [String(err.currentVersion)] });
    }
    return serverError();
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return notFound("Whiteboard");

    const board = await WhiteboardService.findById(id);
    if (!board || !WhiteboardService.canRead(board, session.user.id, session.user.role)) return notFound("Whiteboard");
    if (!(await WhiteboardService.canModify(board, session.user.id, session.user.role))) return forbidden();

    await WhiteboardService.softDelete(id);
    return successResponse(null, "Whiteboard deleted");
  } catch {
    return serverError();
  }
}
