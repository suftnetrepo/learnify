import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { TutorService } from "@/services";
import { successResponse, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const { id } = await params;
    const result  = await TutorService.revokeInvitation(id, session.user.id);
    if (!result) return notFound("Invitation");
    return successResponse(null, "Invitation revoked");
  } catch (error) {
    return serverError();
  }
}
