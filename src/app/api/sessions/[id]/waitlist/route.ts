import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { SessionService } from "@/services";
import {
  successResponse, createdResponse, unauthorized,
  forbidden, serverError, conflict,
} from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)              return unauthorized();
    if (session.user.role !== "admin") return forbidden();
    const { id } = await params;
    const waitlist = await SessionService.getWaitlist(id);
    return successResponse(waitlist);
  } catch { return serverError(); }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)                return unauthorized();
    if (session.user.role !== "student") return forbidden("Only students can join a waitlist");

    const { id } = await params;
    const entry   = await SessionService.joinWaitlist(id, session.user.id);
    return createdResponse(entry, `You're on the waitlist at position ${entry.position}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Already on waitlist")) {
      return conflict(error.message);
    }
    return serverError();
  }
}
