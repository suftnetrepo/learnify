import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { lectures, courseSections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  successResponse, unauthorized, forbidden,
  notFound, serverError, validationError,
} from "@/lib/api-response";
import { requireCourseAccess } from "@/lib/access/course";

const updateSchema = z.object({
  title:         z.string().min(2).max(200).optional(),
  description:   z.string().optional(),
  videoUrl:      z.string().url().optional().or(z.literal("")),
  videoPublicId: z.string().optional(),
  videoDuration: z.number().int().min(0).optional(),
  thumbnailUrl:  z.string().url().optional().or(z.literal("")),
  resourceUrl:   z.string().url().optional().or(z.literal("")),
  resourceName:  z.string().max(200).optional(),
  isFree:        z.boolean().optional(),
  isPublished:   z.boolean().optional(),
  sortOrder:     z.number().int().min(0).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id } = await params;

    const [existingLecture] = await db
      .select({ courseId: courseSections.courseId })
      .from(lectures)
      .innerJoin(courseSections, eq(lectures.sectionId, courseSections.id))
      .where(eq(lectures.id, id))
      .limit(1);
    if (!existingLecture) return notFound("Lecture");

    const allowed = await requireCourseAccess(session.user.id, existingLecture.courseId, session.user.role, "editor");
    if (!allowed) return forbidden("Insufficient course access");

    const parsed  = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const [lecture] = await db
      .update(lectures)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(lectures.id, id))
      .returning();

    if (!lecture) return notFound("Lecture");
    return successResponse(lecture);
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

    const { id } = await params;

    const [existingLecture] = await db
      .select({ courseId: courseSections.courseId })
      .from(lectures)
      .innerJoin(courseSections, eq(lectures.sectionId, courseSections.id))
      .where(eq(lectures.id, id))
      .limit(1);
    if (!existingLecture) return notFound("Lecture");

    const allowed = await requireCourseAccess(session.user.id, existingLecture.courseId, session.user.role, "editor");
    if (!allowed) return forbidden("Insufficient course access");

    const [deleted] = await db
      .delete(lectures)
      .where(eq(lectures.id, id))
      .returning({ id: lectures.id });

    if (!deleted) return notFound("Lecture");
    return successResponse(null, "Lecture deleted");
  } catch (error) {
    return serverError();
  }
}
