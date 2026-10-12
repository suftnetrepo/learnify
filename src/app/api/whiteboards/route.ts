import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { WhiteboardService } from "@/services/whiteboard.service";
import { successResponse, createdResponse, unauthorized, forbidden, serverError, validationError } from "@/lib/api-response";
import { readWhiteboardBody, fieldErrors } from "@/lib/whiteboards/api";
import { z } from "zod";

const createSchema = z.object({
  title:     z.string().trim().min(1).max(200),
  // Classroom boards are created by the live-session flow (Milestone 3), not directly
  mode:      z.literal("individual").default("individual"),
  courseId:  z.uuid().nullish(),
  lectureId: z.uuid().nullish(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const courseId = req.nextUrl.searchParams.get("courseId") ?? undefined;
    if (courseId && !z.uuid().safeParse(courseId).success) {
      return validationError({ courseId: ["Invalid course id"] });
    }

    const boards = await WhiteboardService.list(session.user.id, { courseId });
    return successResponse(boards);
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const read = await readWhiteboardBody(req);
    if (!read.ok) return read.response;

    const parsed = createSchema.safeParse(read.body);
    if (!parsed.success) return fieldErrors(parsed.error.flatten().fieldErrors);

    const { title, mode, courseId, lectureId } = parsed.data;
    const associationError = await WhiteboardService.checkAssociation(
      session.user.id, session.user.role, courseId, lectureId,
    );
    if (associationError) return forbidden(associationError);

    const board = await WhiteboardService.create(session.user.id, { title, mode, courseId, lectureId });
    return createdResponse(board, "Whiteboard created");
  } catch {
    return serverError();
  }
}
