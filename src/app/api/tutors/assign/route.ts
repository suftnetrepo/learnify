import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { TutorService } from "@/services";
import { assignTutorSchema } from "@/lib/validations/course";
import {
  createdResponse, unauthorized, forbidden,
  serverError, validationError, conflict, successResponse,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const body   = await req.json();
    const parsed = assignTutorSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const assignment = await TutorService.assign(parsed.data, session.user.id);

    // Email the tutor (non-fatal)
    try {
      const { EmailService } = await import("@/services/email.service");
      const { UserService }  = await import("@/services/user.service");
      const { CourseService } = await import("@/services/course.service");
      const [tutor, course] = await Promise.all([
        UserService.findById(parsed.data.tutorId),
        CourseService.findById(parsed.data.courseId),
      ]);
      if (tutor?.email && course) {
        await EmailService.tutorAssigned(tutor.email, {
          tutorName:   tutor.name ?? "Instructor",
          courseTitle: course.title,
          startDate:   new Date(parsed.data.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
          endDate:     new Date(parsed.data.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        });
      }
    } catch (emailErr) {
      log.warn("Tutor assigned email failed", { emailErr });
    }

    return createdResponse(assignment, "Tutor assigned successfully");
  } catch (error) {
    if (error instanceof Error && ["not found","not active","already has"].some(m => error.message.toLowerCase().includes(m))) {
      return conflict(error.message);
    }
    log.error("POST /api/tutors/assign", { error });
    return serverError();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return serverError("Assignment ID required");

    await TutorService.cancelAssignment(id, session.user.id);
    return successResponse(null, "Assignment cancelled");
  } catch (error) {
    log.error("DELETE /api/tutors/assign", { error });
    return serverError();
  }
}
