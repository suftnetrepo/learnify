import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { SessionService } from "@/services";
import { z } from "zod";
import {
  successResponse, unauthorized, forbidden,
  notFound, serverError, validationError, conflict,
} from "@/lib/api-response";

// Optional text fields accept null so an edit can clear them (e.g. remove a meeting password)
const updateSchema = z.object({
  title:              z.string().min(2).max(200).optional(),
  description:        z.string().max(1000).nullish(),
  startDatetime:      z.string().datetime().optional(),
  endDatetime:        z.string().datetime().optional(),
  capacity:           z.number().int().min(1).optional(),
  venueAddress:       z.string().max(500).nullish(),
  venueCity:          z.string().max(100).nullish(),
  venuePostcode:      z.string().max(20).nullish(),
  venueMapUrl:        z.string().url().nullish(),
  conferencePlatform: z.enum(["zoom","teams","google_meet","webex","other"]).nullish(),
  conferenceUrl:      z.string().url().nullish(),
  conferencePassword: z.string().max(100).nullish(),
  status:             z.enum(["scheduled","cancelled","completed"]).optional(),
  isPublished:        z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id } = await params;
    const s = await SessionService.findById(id);
    if (!s) return notFound("Session");
    if (!s.isPublished && !(await SessionService.canManageCourseSessions(session.user.id, session.user.role, s.courseId))) {
      return notFound("Session");
    }
    const canSeeJoin = await SessionService.canSeeJoinDetails(session.user.id, session.user.role, s.courseId);
    return successResponse(canSeeJoin ? s : SessionService.withoutJoinDetails(s));
  } catch { return serverError(); }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)              return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const { id } = await params;
    const body   = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string,string[]>);

    const existing = await SessionService.findById(id);
    if (!existing) return notFound("Session");
    const { capacity, startDatetime, endDatetime } = parsed.data;
    if (capacity !== undefined && capacity < existing.enrolledCount) {
      return validationError({ capacity: [`Can't be below the ${existing.enrolledCount} students already booked`] });
    }
    const start = startDatetime ? new Date(startDatetime) : existing.startDatetime;
    const end   = endDatetime   ? new Date(endDatetime)   : existing.endDatetime;
    if (end <= start) return validationError({ endDatetime: ["End must be after the start"] });

    const updated = await SessionService.update(id, parsed.data, session.user.id);
    return successResponse(updated, "Session updated");
  } catch (error) {
    return serverError(error instanceof Error ? error.message : undefined);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)              return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const { id } = await params;
    await SessionService.delete(id, session.user.id);
    return successResponse(null, "Session deleted");
  } catch (error) {
    if (error instanceof Error && error.message.includes("enrolled students")) {
      return conflict(error.message);
    }
    return serverError();
  }
}
