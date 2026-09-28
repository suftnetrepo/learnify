import { NextRequest } from "next/server";
import { CourseMessagingService } from "@/services";
import { courseAccess } from "@/lib/messaging/route-helpers";
import { errorResponse, serverError, successResponse } from "@/lib/api-response";
import { log } from "@/lib/logger";

/**
 * GET /api/courses/[id]/active-session → { isLive, session }
 * Live = a "scheduled" session with startDatetime ≤ now < endDatetime.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params;
    const access = await courseAccess(courseId);
    if (!access.ok) return errorResponse(access.message, "ACCESS_DENIED", access.status);
    const session = await CourseMessagingService.activeSession(
      courseId, access.courseRole === "student" ? access.viewer.id : undefined,
    );
    return successResponse({ isLive: !!session, session });
  } catch (error) {
    log.error("Active session lookup failed", { error });
    return serverError();
  }
}
