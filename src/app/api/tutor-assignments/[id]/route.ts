import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { tutorAssignments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { successResponse, unauthorized, forbidden, validationError, serverError } from "@/lib/api-response";

const schema = z.object({
  accessLevel: z.enum(["viewer", "editor", "manager"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user)                return unauthorized();
    if (session.user.role !== "admin") return forbidden("Admins only");

    const { id } = await params;
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    await db
      .update(tutorAssignments)
      .set({ accessLevel: parsed.data.accessLevel })
      .where(eq(tutorAssignments.id, id));

    return successResponse({ updated: true });
  } catch {
    return serverError();
  }
}
