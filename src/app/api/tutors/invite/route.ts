import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { TutorService } from "@/services";
import { z } from "zod";
import { createdResponse, unauthorized, forbidden, serverError, validationError } from "@/lib/api-response";
import { log } from "@/lib/logger";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const invitation = await TutorService.createInvitation(parsed.data.email, session.user.id);

    // Send invitation email (non-fatal)
    try {
      const { EmailService } = await import("@/services/email.service");
      const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const inviteUrl = `${appUrl}/register?token=${invitation.token}&email=${encodeURIComponent(parsed.data.email)}&role=tutor`;
      await EmailService.tutorInvitation(parsed.data.email, {
        inviteUrl,
        expiresIn: "7 days",
      });
    } catch (emailErr) {
      log.warn("Invitation email failed", { emailErr });
    }

    return createdResponse(invitation, "Invitation sent");
  } catch (error) {
    log.error("POST /api/tutors/invite", { error });
    return serverError();
  }
}
