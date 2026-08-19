import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, notFound, serverError } from "@/lib/api-response";
import { db } from "@/db";
import { enrollments, courses, courseSessions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { log } from "@/lib/logger";

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
        id:           enrollments.id,
        sessionId:    enrollments.sessionId,
        enrolledAt:   enrollments.enrolledAt,
        courseTitle:  courses.title,
        courseFormat: courses.format,
        studentName:  users.name,
        studentEmail: users.email,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .innerJoin(users,   eq(enrollments.studentId, users.id))
      .where(and(
        eq(enrollments.id, enrollmentId),
        eq(enrollments.studentId, session.user.id) // own enrollment only
      ))
      .limit(1);

    if (!enrollment) return notFound("Enrollment");

    let sess = null;
    if (enrollment.sessionId) {
      const [s] = await db
        .select()
        .from(courseSessions)
        .where(eq(courseSessions.id, enrollment.sessionId))
        .limit(1);
      sess = s ?? null;
    }

    const pdfBuffer = await buildBookingConfirmationPdf({
      bookingRef:   enrollment.id.slice(0, 8).toUpperCase(),
      studentName:  enrollment.studentName ?? "Student",
      studentEmail: enrollment.studentEmail,
      courseTitle:  enrollment.courseTitle,
      courseFormat: enrollment.courseFormat,
      enrolledAt:   enrollment.enrolledAt,
      session: sess,
    });

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="learnify-booking-confirmation.pdf"`,
      },
    });
  } catch (error) {
    log.error("GET /api/enrollments/:id/booking-confirmation", { error });
    return serverError();
  }
}

// ─── PDF builder ──────────────────────────────────────────────────────────────
// Same buffer-via-Promise pattern as generateAndStoreCertificate() in
// src/lib/certificate/index.ts — pdfkit is already a project dependency,
// used there for course-completion certificates.
async function buildBookingConfirmationPdf(data: {
  bookingRef:   string;
  studentName:  string;
  studentEmail: string;
  courseTitle:  string;
  courseFormat: string;
  enrolledAt:   Date;
  session: {
    title:               string | null;
    startDatetime:       Date;
    endDatetime:          Date;
    venueAddress:        string | null;
    venueCity:           string | null;
    venuePostcode:       string | null;
    conferencePlatform:  string | null;
    conferenceUrl:       string | null;
    conferencePassword:  string | null;
  } | null;
}): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  const formatDate = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(d));
  const formatTime = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(d));
  const formatLabel = data.courseFormat === "in_person" ? "In-person" : data.courseFormat === "hybrid" ? "Hybrid" : "Online";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data",  (chunk) => chunks.push(chunk));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W    = 595.28; // A4 width (points)
    const boxX = 50;
    const boxW = W - 100;
    const padX = 16;
    const textW = boxW - padX * 2;
    let y = 50;

    // Draws a labelled rounded box (first line bold/larger as a heading,
    // the rest as body lines) and returns the y position below it — heights
    // are measured via heightOfString first so wrapped lines (e.g. a long
    // join URL) don't overflow the box.
    function section(label: string, lines: string[]) {
      let contentH = 16; // label row
      lines.forEach((line, i) => {
        doc.fontSize(i === 0 ? 13 : 11);
        contentH += doc.heightOfString(line, { width: textW }) + (i === 0 ? 6 : 4);
      });
      const boxH = 14 + contentH + 10;

      doc.roundedRect(boxX, y, boxW, boxH, 8).fill("#f8f8fc");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#6b7280")
        .text(label.toUpperCase(), boxX + padX, y + 14, { characterSpacing: 1 });

      let ly = y + 14 + 16;
      lines.forEach((line, i) => {
        doc.fontSize(i === 0 ? 13 : 11)
          .font(i === 0 ? "Helvetica-Bold" : "Helvetica")
          .fillColor(i === 0 ? "#13131f" : "#374151")
          .text(line, boxX + padX, ly, { width: textW });
        ly += doc.heightOfString(line, { width: textW }) + (i === 0 ? 6 : 4);
      });

      y += boxH + 16;
    }

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#6366f1").text("LEARNIFY", boxX, y, { characterSpacing: 2 });
    y += 26;
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#13131f").text("Booking Confirmation", boxX, y);
    y += 30;
    doc.roundedRect(boxX, y, 92, 22, 11).fill("#ecfdf5");
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#065f46").text("Confirmed", boxX, y + 6, { width: 92, align: "center" });
    y += 40;
    doc.moveTo(boxX, y).lineTo(W - boxX, y).lineWidth(2).stroke("#6366f1");
    y += 24;

    // ── Sections ─────────────────────────────────────────────────────────────
    section("Student", [data.studentName, data.studentEmail]);

    section("Course", [
      data.courseTitle,
      `${formatLabel} course`,
      `Enrolled: ${formatDate(data.enrolledAt)}`,
    ]);

    if (data.session) {
      const lines = [
        data.session.title ?? "Live Session",
        `Date: ${formatDate(data.session.startDatetime)}`,
        `Time: ${formatTime(data.session.startDatetime)} – ${formatTime(data.session.endDatetime)}`,
      ];
      if (data.session.venueAddress) {
        lines.push(`Venue: ${data.session.venueAddress}`);
        if (data.session.venueCity) {
          lines.push(`${data.session.venueCity}${data.session.venuePostcode ? `, ${data.session.venuePostcode}` : ""}`);
        }
      }
      if (data.session.conferenceUrl) {
        lines.push(`Join online: ${data.session.conferencePlatform ?? "Video call"}`);
        lines.push(data.session.conferenceUrl);
        if (data.session.conferencePassword) lines.push(`Password: ${data.session.conferencePassword}`);
      }
      section("Session", lines);
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.moveTo(boxX, y).lineTo(W - boxX, y).lineWidth(0.5).stroke("#e5e7eb");
    y += 16;
    doc.fontSize(9).font("Helvetica").fillColor("#9ca3af");
    doc.text(`Booking reference: ${data.bookingRef}`, boxX, y);
    y += doc.heightOfString(`Booking reference: ${data.bookingRef}`) + 8;
    doc.text("Please bring this confirmation and a valid photo ID to the venue. For support: hello@learnify.dev", boxX, y, { width: boxW });
    y += doc.heightOfString("Please bring this confirmation and a valid photo ID to the venue. For support: hello@learnify.dev", { width: boxW }) + 12;
    doc.text("© Learnify · 30-day money-back guarantee", boxX, y);

    doc.end();
  });
}
