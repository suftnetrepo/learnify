import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { log } from "@/lib/logger";
import {
  forbidden,
  notFound,
  serverError,
  successResponse,
  unauthorized,
  validationError,
} from "@/lib/api-response";
import { SessionService } from "@/services/session.service";
import { EmailService } from "@/services/email.service";

const messageSchema = z.object({
  candidateIds: z.array(z.string().uuid()).min(1).max(500),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(2).max(10_000),
});

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) return { response: unauthorized() };
  if (session.user.role !== "admin") return { response: forbidden() };
  return { session };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  try {
    const { id } = await params;
    const result = await SessionService.getCandidates(id);
    if (!result) return notFound("Session");
    return successResponse(result);
  } catch (error) {
    log.error("Could not load session candidates", { error });
    return serverError();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await requireAdmin();
  if ("response" in access) return access.response;

  try {
    const parsed = messageSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const { id } = await params;
    const result = await SessionService.getCandidates(id);
    if (!result) return notFound("Session");

    const requested = new Set(parsed.data.candidateIds);
    const recipients = result.candidates.filter((candidate) => requested.has(candidate.id));
    if (!recipients.length || recipients.length !== requested.size) {
      return forbidden("One or more selected candidates are not enrolled in this session");
    }

    await Promise.all(recipients.map((candidate) => EmailService.sessionCandidateMessage(candidate.email, {
      candidateName: candidate.name ?? "there",
      courseTitle: result.session.courseTitle,
      sessionTitle: result.session.title,
      subject: parsed.data.subject,
      message: parsed.data.message,
    })));

    log.info("Session candidate email submitted", {
      sessionId: id,
      recipientCount: recipients.length,
      sentBy: access.session.user.id,
    });
    return successResponse(
      { recipientCount: recipients.length },
      `Message submitted for delivery to ${recipients.length} candidate${recipients.length === 1 ? "" : "s"}`
    );
  } catch (error) {
    log.error("Could not email session candidates", { error });
    return serverError();
  }
}
