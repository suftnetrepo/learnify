import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { ResourceService } from "@/services";
import { successResponse, unauthorized, forbidden, serverError } from "@/lib/api-response";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden("Admins only");
    const { id } = await params;
    await ResourceService.delete(id);
    return successResponse({ deleted: true });
  } catch {
    return serverError();
  }
}
