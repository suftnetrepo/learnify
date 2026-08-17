import { db } from "@/db";
import { enrollments, users, courses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { cloudinary } from "@/lib/cloudinary";
import { log } from "@/lib/logger";

/**
 * Generates a PDF certificate for a completed course enrolment,
 * uploads it to Cloudinary, and stores the URL in the enrollment record.
 */
export async function generateAndStoreCertificate(
  userId:   string,
  courseId: string
): Promise<string | null> {
  // Fetch student and course info
  const [[student], [course], [enrollment]] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1),
    db.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId)).limit(1),
    db.select({ id: enrollments.id, completedAt: enrollments.completedAt, certificateUrl: enrollments.certificateUrl })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, userId), eq(enrollments.courseId, courseId)))
      .limit(1),
  ]);

  if (!student || !course || !enrollment) return null;
  // Don't regenerate if already issued
  if (enrollment.certificateUrl) return enrollment.certificateUrl;

  const completionDate = enrollment.completedAt ?? new Date();
  const formattedDate  = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  }).format(completionDate);

  // Generate PDF as a Buffer using pdfkit
  const pdfBuffer = await buildCertificatePdf({
    studentName:  student.name ?? "Student",
    courseTitle:  course.title,
    completionDate: formattedDate,
  });

  // Upload to Cloudinary as a raw file
  const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        folder:        "learnify/certificates",
        public_id:     `certificate-${userId}-${courseId}`,
        format:        "pdf",
        overwrite:     true,
      },
      (error, result) => {
        if (error || !result) reject(error ?? new Error("Upload failed"));
        else resolve(result as { secure_url: string });
      }
    );
    stream.end(pdfBuffer);
  });

  const certificateUrl = uploadResult.secure_url;

  // Store URL in enrollment record
  await db
    .update(enrollments)
    .set({ certificateUrl, certificateIssuedAt: new Date() })
    .where(eq(enrollments.id, enrollment.id));

  log.info("Certificate generated", { userId, courseId, certificateUrl });
  return certificateUrl;
}

// ─── PDF builder ──────────────────────────────────────────────────────────────
async function buildCertificatePdf(data: {
  studentName:    string;
  courseTitle:    string;
  completionDate: string;
}): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
    const chunks: Buffer[] = [];

    doc.on("data",  (chunk) => chunks.push(chunk));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = 841.89; // A4 landscape width  (points)
    const H = 595.28; // A4 landscape height (points)

    // ── Background ────────────────────────────────────────────────────────────
    // Deep navy background
    doc.rect(0, 0, W, H).fill("#13131f");

    // Accent border frame
    doc.rect(24, 24, W - 48, H - 48)
       .lineWidth(2)
       .stroke("#6366f1");

    // Subtle inner frame
    doc.rect(32, 32, W - 64, H - 64)
       .lineWidth(0.5)
       .stroke("#2e2e4e");

    // Brand gradient-style accent bar at top
    doc.rect(24, 24, W - 48, 6).fill("#6366f1");

    // ── Logo area ─────────────────────────────────────────────────────────────
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#6366f1")
      .text("LEARNIFY", 0, 70, { align: "center", characterSpacing: 6 });

    // ── Certificate heading ───────────────────────────────────────────────────
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#6b7280")
      .text("CERTIFICATE OF COMPLETION", 0, 102, { align: "center", characterSpacing: 3 });

    // Divider line
    doc.moveTo(W / 2 - 80, 124).lineTo(W / 2 + 80, 124).lineWidth(0.5).stroke("#2e2e4e");

    // ── "This is to certify" ──────────────────────────────────────────────────
    doc
      .fontSize(13)
      .font("Helvetica")
      .fillColor("#9ca3af")
      .text("This is to certify that", 0, 148, { align: "center" });

    // ── Student name ──────────────────────────────────────────────────────────
    doc
      .fontSize(36)
      .font("Helvetica-Bold")
      .fillColor("#ffffff")
      .text(data.studentName, 60, 178, { align: "center" });

    // Underline
    const nameWidth = Math.min(doc.widthOfString(data.studentName), W - 160);
    doc
      .moveTo((W - nameWidth) / 2, 224)
      .lineTo((W + nameWidth) / 2, 224)
      .lineWidth(1)
      .stroke("#6366f1");

    // ── "has successfully completed" ──────────────────────────────────────────
    doc
      .fontSize(13)
      .font("Helvetica")
      .fillColor("#9ca3af")
      .text("has successfully completed", 0, 240, { align: "center" });

    // ── Course title ──────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .fillColor("#a5b4fc")
      .text(data.courseTitle, 60, 268, { align: "center" });

    // ── Date ──────────────────────────────────────────────────────────────────
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#6b7280")
      .text(`Completed on ${data.completionDate}`, 0, 330, { align: "center" });

    // ── Bottom decorations ────────────────────────────────────────────────────
    // Seal circle
    doc
      .circle(W / 2, 460, 36)
      .lineWidth(2)
      .stroke("#6366f1");

    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor("#6366f1")
      .text("VERIFIED", W / 2 - 20, 453, { align: "left", characterSpacing: 1 } as any);

    // Footer
    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#374151")
      .text("learnify.com", 0, H - 50, { align: "center" });

    doc.end();
  });
}
