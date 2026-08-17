import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { enrollments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateAndStoreCertificate } from "@/lib/certificate";
import { unauthorized, notFound, serverError } from "@/lib/api-response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { id: enrollmentId } = await params;

    const [enrollment] = await db
      .select({
        id:             enrollments.id,
        studentId:      enrollments.studentId,
        courseId:       enrollments.courseId,
        progress:       enrollments.progress,
        completedAt:    enrollments.completedAt,
        certificateUrl: enrollments.certificateUrl,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.id,        enrollmentId),
          eq(enrollments.studentId, session.user.id) // own enrollment only
        )
      )
      .limit(1);

    if (!enrollment) return notFound("Enrollment");
    if (enrollment.progress < 100) {
      return NextResponse.json(
        { success: false, message: "Complete the course to download your certificate." },
        { status: 400 }
      );
    }

    // Generate if not yet issued
    let url = enrollment.certificateUrl;
    if (!url) {
      url = await generateAndStoreCertificate(enrollment.studentId, enrollment.courseId);
    }

    if (!url) return serverError("Certificate could not be generated.");

    return NextResponse.redirect(url);
  } catch (error) {
    return serverError();
  }
}
