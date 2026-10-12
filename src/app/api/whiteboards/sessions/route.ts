import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courseSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { WhiteboardService } from "@/services/whiteboard.service";
import { WhiteboardSessionService } from "@/services/whiteboard-session.service";
import { successResponse, createdResponse, unauthorized, forbidden, notFound, serverError, validationError } from "@/lib/api-response";
import { fieldErrors } from "@/lib/whiteboards/api";
import { z } from "zod";

const createSchema = z.object({
  whiteboardId:    z.uuid(),
  courseSessionId: z.uuid().nullish(),
});

/**
 * Create a live session for a whiteboard, or resume its active one. Anyone allowed to join
 * the active session gets it back; creating needs the owner or a tutor/admin on the course.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id: userId, role } = session.user;

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fieldErrors(parsed.error.flatten().fieldErrors);
    const { whiteboardId, courseSessionId = null } = parsed.data;

    const board = await WhiteboardService.findById(whiteboardId);
    if (!board) return notFound("Whiteboard");

    const active = await WhiteboardSessionService.findActiveForWhiteboard(whiteboardId);
    if (active) {
      if (!(await WhiteboardSessionService.joinRole(active, userId, role))) return notFound("Live session");
      return successResponse({ sessionId: active.id, resumed: true });
    }

    // Linking a course session: it must exist and the caller must teach (or administer) its course
    let courseId: string | null = null;
    if (courseSessionId) {
      const [cs] = await db.select({ courseId: courseSessions.courseId }).from(courseSessions)
        .where(eq(courseSessions.id, courseSessionId)).limit(1);
      if (!cs) return validationError({ courseSessionId: ["Course session not found"] });
      if (role !== "admin" && role !== "tutor") return forbidden("Only tutors can link a course session");
      courseId = cs.courseId;
    }

    if (!(await WhiteboardSessionService.canCreate(board, userId, role, courseId))) {
      // Don't reveal boards the caller couldn't read anyway
      return WhiteboardService.canRead(board, userId, role) ? forbidden("You can't start a session on this whiteboard") : notFound("Whiteboard");
    }

    const { sessionId, created } = await WhiteboardSessionService.createOrResume(whiteboardId, userId, courseSessionId);
    return created
      ? createdResponse({ sessionId, resumed: false }, "Live session started")
      : successResponse({ sessionId, resumed: true });
  } catch {
    return serverError();
  }
}
