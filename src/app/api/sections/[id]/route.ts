import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courseSections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  successResponse, unauthorized, forbidden,
  notFound, serverError, validationError,
} from "@/lib/api-response";

const updateSchema = z.object({
  title:       z.string().min(2).max(200).optional(),
  description: z.string().max(1000).optional(),
  sortOrder:   z.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!["admin", "tutor"].includes(session.user.role)) return forbidden();

    const { id } = await params;
    const parsed  = updateSchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const [section] = await db
      .update(courseSections)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(courseSections.id, id))
      .returning();

    if (!section) return notFound("Section");
    return successResponse(section);
  } catch (error) {
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const { id } = await params;
    await db.delete(courseSections).where(eq(courseSections.id, id));
    return successResponse(null, "Section deleted");
  } catch (error) {
    return serverError();
  }
}
