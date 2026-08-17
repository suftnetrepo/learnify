import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { lectures, courseSections, courses } from "@/db/schema";
import { eq, sql, count, desc } from "drizzle-orm";
import { z } from "zod";
import {
  successResponse, createdResponse, unauthorized,
  forbidden, notFound, serverError, validationError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

const createLectureSchema = z.object({
  title:        z.string().min(2).max(200).trim(),
  description:  z.string().optional(),
  videoUrl:     z.string().url().optional(),
  videoPublicId: z.string().optional(),
  videoDuration: z.number().int().min(0).optional(),  // seconds
  thumbnailUrl: z.string().url().optional(),
  resourceUrl:  z.string().url().optional(),
  resourceName: z.string().max(200).optional(),
  isFree:       z.boolean().default(false),
  sortOrder:    z.number().int().min(0).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!["admin", "tutor"].includes(session.user.role)) return forbidden();

    const { id: sectionId } = await params;

    // Verify section exists and get courseId for updating counts
    const [section] = await db
      .select({ id: courseSections.id, courseId: courseSections.courseId })
      .from(courseSections)
      .where(eq(courseSections.id, sectionId))
      .limit(1);

    if (!section) return notFound("Section");

    const body   = await req.json();
    const parsed = createLectureSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Default sortOrder
        let { sortOrder } = parsed.data;
    if (sortOrder === undefined) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(lectures)
        .where(eq(lectures.sectionId, sectionId));
      sortOrder = total;
    }

    const [lecture] = await db
      .insert(lectures)
      .values({
        sectionId,
        title:         parsed.data.title,
        description:   parsed.data.description,
        videoUrl:      parsed.data.videoUrl,
        videoPublicId: parsed.data.videoPublicId,
        videoDuration: parsed.data.videoDuration,
        thumbnailUrl:  parsed.data.thumbnailUrl,
        resourceUrl:   parsed.data.resourceUrl,
        resourceName:  parsed.data.resourceName,
        isFree:        parsed.data.isFree,
        isPublished:   false,
        sortOrder,
      })
      .returning();

    // Update course lecture count and total duration
    await db
      .update(courses)
      .set({
        totalLectures: sql`${courses.totalLectures} + 1`,
        totalDuration: parsed.data.videoDuration
          ? sql`COALESCE(${courses.totalDuration}, 0) + ${Math.round(parsed.data.videoDuration / 60)}`
          : courses.totalDuration,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, section.courseId));

    log.info("Lecture created", { lectureId: lecture.id, sectionId });
    return createdResponse(lecture);
  } catch (error) {
    log.error("POST /api/sections/:id/lectures", { error });
    return serverError();
  }
}
