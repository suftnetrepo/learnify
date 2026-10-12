import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { WhiteboardService } from "@/services/whiteboard.service";
import { createdResponse, unauthorized, notFound, serverError } from "@/lib/api-response";
import { z } from "zod";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return notFound("Whiteboard");

    const source = await WhiteboardService.findById(id);
    if (!source || !WhiteboardService.canRead(source, session.user.id, session.user.role)) return notFound("Whiteboard");

    const copy = await WhiteboardService.duplicate(id, session.user.id);
    if (!copy) return notFound("Whiteboard");
    return createdResponse(copy, "Whiteboard duplicated");
  } catch {
    return serverError();
  }
}
