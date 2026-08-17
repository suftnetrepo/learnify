import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { SessionService } from "@/services";
import { z } from "zod";
import {
  successResponse, createdResponse, unauthorized, forbidden, serverError, validationError,
} from "@/lib/api-response";

const createSchema = z.object({
  title:              z.string().min(2).max(200),
  description:        z.string().max(1000).optional(),
  startDatetime:      z.string().datetime(),
  endDatetime:        z.string().datetime(),
  capacity:           z.number().int().min(1).max(10000),
  venueAddress:       z.string().max(500).optional(),
  venueCity:          z.string().max(100).optional(),
  venuePostcode:      z.string().max(20).optional(),
  venueMapUrl:        z.string().url().optional().or(z.literal("")),
  conferencePassword: z.string().max(100).optional(),
  conferencePlatform: z.enum(["zoom","teams","google_meet","webex","other"]).optional(),
  conferenceUrl:      z.string().url().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id: courseId } = await params;
    const sessions = await SessionService.getForCourse(courseId);
    return successResponse(sessions);
  } catch (error) {
    return serverError();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)              return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const { id: courseId } = await params;
    const body   = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string,string[]>);

    const created = await SessionService.create(
      { ...parsed.data, courseId },
      session.user.id
    );
    return createdResponse(created, "Session created");
  } catch (error) {
    return serverError(error instanceof Error ? error.message : undefined);
  }
}
