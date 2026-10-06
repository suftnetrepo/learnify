import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { requireCourseAccess } from "@/lib/access/course";
import { cloudinary } from "@/lib/cloudinary";
import { parseCloudinaryUrl } from "@/lib/handout";
import { log } from "@/lib/logger";

const LINK_TTL_SECONDS = 300;

/**
 * Download the staff-only facilitator handbook.
 * Allowed: admins and active tutors assigned to the course. Students never pass.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id: courseId } = await params;
  const { id: userId, role } = session.user;
  const allowed = role === "admin" || (
    role === "tutor" && await requireCourseAccess(userId, courseId, role, "viewer")
  );

  if (!allowed) {
    return NextResponse.json({ error: "Active tutor assignment required" }, { status: 403 });
  }

  const [course] = await db
    .select({ handbookUrl: courses.facilitatorHandbookUrl })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course?.handbookUrl) {
    return NextResponse.json({ error: "This course has no facilitator handbook" }, { status: 404 });
  }

  const asset = parseCloudinaryUrl(course.handbookUrl);
  if (!asset) return NextResponse.redirect(course.handbookUrl);

  try {
    const url = cloudinary.utils.private_download_url(asset.publicId, asset.format, {
      resource_type: asset.resourceType,
      type:          asset.type,
      attachment:    true,
      expires_at:    Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
    });
    return NextResponse.redirect(url);
  } catch (error) {
    log.error("Facilitator handbook download link failed", { courseId, error });
    return NextResponse.json({ error: "Couldn't prepare the download" }, { status: 500 });
  }
}
