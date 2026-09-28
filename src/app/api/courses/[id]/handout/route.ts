import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courses, enrollments } from "@/db/schema";
import { requireCourseAccess } from "@/lib/access/course";
import { cloudinary } from "@/lib/cloudinary";
import { parseCloudinaryUrl } from "@/lib/handout";
import { log } from "@/lib/logger";

const LINK_TTL_SECONDS = 300;

/**
 * GET /api/courses/[id]/handout — download the course handout (handbook).
 * Allowed: enrolled students, tutors assigned to the course, admins. Redirects to a signed
 * Cloudinary download link valid for 5 minutes (downloads as the original file name).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { id: courseId } = await params;
  const { id: userId, role } = session.user;

  const [course] = await db
    .select({ handoutUrl: courses.handoutUrl })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);
  if (!course?.handoutUrl) {
    return NextResponse.json({ error: "This course has no handout" }, { status: 404 });
  }

  let allowed = role === "admin";
  if (!allowed && role === "tutor") {
    allowed = await requireCourseAccess(userId, courseId, role, "viewer");
  }
  if (!allowed) {
    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, userId), eq(enrollments.courseId, courseId)))
      .limit(1);
    allowed = !!enrollment;
  }
  if (!allowed) {
    return NextResponse.json({ error: "Enrol in this course to download its handout" }, { status: 403 });
  }

  const asset = parseCloudinaryUrl(course.handoutUrl);
  if (!asset) {
    // Not a Cloudinary file (e.g. an external link) — nothing to sign
    return NextResponse.redirect(course.handoutUrl);
  }

  try {
    const url = cloudinary.utils.private_download_url(asset.publicId, asset.format, {
      resource_type: asset.resourceType,
      type:          asset.type,
      attachment:    true,
      expires_at:    Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
    });
    return NextResponse.redirect(url);
  } catch (error) {
    log.error("Handout download link failed", { courseId, error });
    return NextResponse.json({ error: "Couldn't prepare the download" }, { status: 500 });
  }
}
