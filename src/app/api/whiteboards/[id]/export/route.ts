import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { WhiteboardService } from "@/services/whiteboard.service";
import { successResponse, unauthorized, notFound, serverError, validationError } from "@/lib/api-response";
import { z } from "zod";

/**
 * Excalidraw's exportToBlob/exportToSvg need a browser canvas and DOM, and the package
 * ships no Node entry, so rendering can't happen here. This returns the scene plus a
 * filename and the client renders it (see exportScenePng/exportSceneSvg in
 * components/whiteboard/ExcalidrawCanvas).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return notFound("Whiteboard");

    const format = req.nextUrl.searchParams.get("format") ?? "png";
    if (format !== "png" && format !== "svg") return validationError({ format: ["Use png or svg"] });

    const board = await WhiteboardService.findById(id);
    if (!board || !WhiteboardService.canRead(board, session.user.id, session.user.role)) return notFound("Whiteboard");

    const safeTitle = board.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "whiteboard";
    return successResponse({
      renderOn:  "client" as const,
      format,
      filename:  `${safeTitle}.${format}`,
      sceneData: board.sceneData,
    });
  } catch {
    return serverError();
  }
}
