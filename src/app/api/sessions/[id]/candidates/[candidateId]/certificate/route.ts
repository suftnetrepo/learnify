import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { certificates, sessionAttendance } from "@/db/schema";
import { SessionService } from "@/services/session.service";
import { EmailService } from "@/services/email.service";
import { issueSessionCertificate } from "@/lib/certificate";
import { conflict, forbidden, notFound, serverError, successResponse, unauthorized, validationError } from "@/lib/api-response";
import { log } from "@/lib/logger";
import { certificateEligibilityError } from "@/lib/certificate/eligibility";

const issueSchema = z.object({
  attendanceStatus: z.enum(["attended", "partial", "absent"]),
  outcome: z.enum(["passed", "incomplete"]),
  attendanceNotes: z.string().trim().max(2000).optional().nullable(),
  certificateType: z.enum(["attendance", "completion"]),
  recipientName: z.string().trim().min(2).max(100),
  completionDate: z.string().datetime(),
  issuerName: z.string().trim().max(100).optional().nullable(),
  certificateNotes: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorized();
  const { id: sessionId, candidateId } = await params;
  if (session.user.role !== "admin" && (
    session.user.role !== "tutor" || !(await SessionService.tutorCanManageSession(session.user.id, sessionId))
  )) return forbidden("You cannot issue certificates for this session");

  try {
    const parsed = issueSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const roster = await SessionService.getCandidates(sessionId);
    if (!roster) return notFound("Session");
    const candidate = roster.candidates.find((item) => item.id === candidateId);
    if (!candidate) return notFound("Candidate");
    if (new Date(roster.session.endDatetime) > new Date()) {
      return conflict("Certificates can be issued after the session has ended");
    }

    const data = parsed.data;
    const eligibilityError = certificateEligibilityError(data.certificateType, data.attendanceStatus, data.outcome);
    if (eligibilityError) return validationError({ certificateType: [eligibilityError] });

    const completionDate = new Date(data.completionDate);
    if (completionDate > new Date()) return validationError({ completionDate: ["The completion date cannot be in the future"] });

    const [existing] = await db.select({ id: certificates.id }).from(certificates).where(and(
      eq(certificates.enrollmentId, candidate.enrollmentId),
      eq(certificates.sessionId, sessionId),
      eq(certificates.status, "active"),
    )).limit(1);
    if (existing) return conflict("This candidate already has an active certificate for the session");

    await db.insert(sessionAttendance).values({
      sessionId,
      enrollmentId: candidate.enrollmentId,
      studentId: candidate.id,
      status: data.attendanceStatus,
      outcome: data.outcome,
      notes: data.attendanceNotes || null,
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    }).onConflictDoUpdate({
      target: [sessionAttendance.sessionId, sessionAttendance.enrollmentId],
      set: {
        status: data.attendanceStatus,
        outcome: data.outcome,
        notes: data.attendanceNotes || null,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const certificate = await issueSessionCertificate({
      enrollmentId: candidate.enrollmentId,
      sessionId,
      studentId: candidate.id,
      courseId: roster.session.courseId,
      recipientName: data.recipientName,
      courseTitle: roster.session.courseTitle,
      sessionTitle: roster.session.title,
      completionDate,
      type: data.certificateType,
      issuerName: data.issuerName,
      notes: data.certificateNotes,
      issuedBy: session.user.id,
    });

    await EmailService.certificateIssued(candidate.email, {
      candidateName: data.recipientName,
      courseTitle: roster.session.courseTitle,
      certificateType: data.certificateType,
      certificateUrl: certificate.pdfUrl,
    });

    return successResponse({ ...certificate, attendanceStatus: data.attendanceStatus, outcome: data.outcome }, "Certificate generated and submitted for email delivery");
  } catch (error) {
    log.error("Could not issue session certificate", { error, sessionId, candidateId, issuedBy: session.user.id });
    return serverError("Certificate could not be generated. No certificate was issued.");
  }
}
