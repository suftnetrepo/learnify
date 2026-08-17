import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courseSections, lectures } from "@/db/schema";
import { eq, asc, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  successResponse, createdResponse, unauthorized,
  forbidden, serverError, validationError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

const createSectionSchema = z.object({
  title:       z.string().min(2).max(200).trim(),
  description: z.string().max(1000).optional(),
  sortOrder:   z.number().int().min(0).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: courseId } = await params;

    const sections = await db
      .select()
      .from(courseSections)
      .where(eq(courseSections.courseId, courseId))
      .orderBy(asc(courseSections.sortOrder));

    // Group lectures by sectionId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lecturesBySectionId: Record<string, any[]> = {};

    if (sections.length > 0) {
      const sectionIds = sections.map((s) => s.id);
      const allLecturesForCourse = await db
        .select()
        .from(lectures)
        .where(inArray(lectures.sectionId, sectionIds))
        .orderBy(asc(lectures.sortOrder));

      for (const lecture of allLecturesForCourse) {
        if (!lecturesBySectionId[lecture.sectionId]) {
          lecturesBySectionId[lecture.sectionId] = [];
        }
        lecturesBySectionId[lecture.sectionId].push(lecture);
      }
    }

    const result = sections.map((s) => ({
      ...s,
      lectures: lecturesBySectionId[s.id] ?? [],
    }));

    return successResponse(result);
  } catch (error) {
    log.error("GET /api/courses/:id/sections", { error });
    return serverError();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (!["admin", "tutor"].includes(session.user.role)) return forbidden();

    const { id: courseId } = await params;
    const body   = await req.json();
    const parsed = createSectionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Default sortOrder to end
    let { sortOrder } = parsed.data;
    if (sortOrder === undefined) {
      const existing = await db
        .select({ sortOrder: courseSections.sortOrder })
        .from(courseSections)
        .where(eq(courseSections.courseId, courseId))
        .orderBy(desc(courseSections.sortOrder))
        .limit(1);
      sortOrder = existing.length > 0 ? (existing[0].sortOrder ?? 0) + 1 : 0;
    }

    const [section] = await db
      .insert(courseSections)
      .values({
        courseId,
        title:       parsed.data.title,
        description: parsed.data.description,
        sortOrder,
      })
      .returning();

    log.info("Section created", { sectionId: section.id, courseId });
    return createdResponse(section);
  } catch (error) {
    log.error("POST /api/courses/:id/sections", { error });
    return serverError();
  }
}
