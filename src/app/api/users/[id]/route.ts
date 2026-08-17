import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { UserService } from "@/services";
import { z } from "zod";
import {
  successResponse, unauthorized, forbidden,
  notFound, serverError, validationError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

const updateSchema = z.object({
  name:   z.string().min(1).max(100).trim().optional(),
  bio:    z.string().max(500).trim().optional(),
  status: z.enum(["active","pending","suspended"]).optional(),
  role:   z.enum(["student","tutor","admin"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const { id } = await params;
    const body   = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const user = await UserService.update(id, parsed.data);
    if (!user) return notFound("User");
    return successResponse(user, "User updated");
  } catch (error) {
    log.error("PATCH /api/users/[id]", { error });
    return serverError();
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const { id } = await params;
    await UserService.softDelete(id);
    return successResponse(null, "User removed");
  } catch (error) {
    log.error("DELETE /api/users/[id]", { error });
    return serverError();
  }
}
