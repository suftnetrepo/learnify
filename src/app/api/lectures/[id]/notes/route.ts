import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { NoteService } from "@/services";
import { successResponse, unauthorized, serverError, validationError } from "@/lib/api-response";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id: lectureId } = await params;
    const note = await NoteService.get(session.user.id, lectureId);
    return successResponse(note);
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id: lectureId } = await params;
    const body   = await req.json();
    const parsed = z.object({ content: z.string() }).safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }
    const note = await NoteService.save(session.user.id, lectureId, parsed.data.content);
    return successResponse(note);
  } catch {
    return serverError();
  }
}
