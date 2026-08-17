import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { SessionService } from "@/services";
import { z } from "zod";
import {
  successResponse, unauthorized, forbidden,
  notFound, serverError, validationError, conflict,
} from "@/lib/api-response";

const updateSchema = z.object({
  title:              z.string().min(2).max(200).optional(),
  description:        z.string().max(1000).optional(),
  startDatetime:      z.string().datetime().optional(),
  endDatetime:        z.string().datetime().optional(),
  capacity:           z.number().int().min(1).optional(),
  venueAddress:       z.string().max(500).optional(),
  venueCity:          z.string().max(100).optional(),
  venuePostcode:      z.string().max(20).optional(),
  venueMapUrl:        z.string().url().optional(),
  conferencePlatform: z.enum(["zoom","teams","google_meet","webex","other"]).optional(),
  conferenceUrl:      z.string().url().optional(),
  conferencePassword: z.string().max(100).optional(),
  status:             z.enum(["scheduled","cancelled","completed"]).optional(),
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
    return successResponse(s);
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
