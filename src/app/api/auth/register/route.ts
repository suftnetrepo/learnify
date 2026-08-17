import { NextRequest } from "next/server";
import { db } from "@/db";
import { users, tutorInvitations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword, generateUniqueSlug } from "@/lib/utils";
import { registerSchema } from "@/lib/validations/auth";
import {
  createdResponse,
  errorResponse,
  conflict,
  serverError,
  validationError,
  tooManyRequests,
} from "@/lib/api-response";
import { limiters, getClientIp } from "@/lib/rate-limit";
import { verifyRecaptcha } from "@/lib/recaptcha/verify";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 registrations per IP per hour
    const limit = limiters.register(getClientIp(req));
    if (!limit.success) return tooManyRequests();

    const body = await req.json();

    // Verify reCAPTCHA token
    const captcha = await verifyRecaptcha(body.recaptchaToken);
    if (!captcha.success) {
      return errorResponse("Security check failed. Please try again.", "CAPTCHA_FAILED", 400);
    }
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(
        parsed.error.flatten().fieldErrors as Record<string, string[]>
      );
    }

    const { name, email, password, role, invitationToken } = parsed.data;

    // Check for existing user
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return conflict("An account with this email already exists");
    }

    // Validate invitation token for tutors
    let invitation = null;
    if (role === "tutor" && invitationToken) {
      const [inv] = await db
        .select()
        .from(tutorInvitations)
        .where(
          and(
            eq(tutorInvitations.token, invitationToken),
            eq(tutorInvitations.email, email),
            eq(tutorInvitations.status, "pending")
          )
        )
        .limit(1);

      if (!inv || inv.expiresAt < new Date()) {
        return errorResponse(
          "This invitation link is invalid or has expired",
          "INVALID_INVITATION",
          400
        );
      }
      invitation = inv;
    }

    const passwordHash = await hashPassword(password);

    // Tutors without invitation start as "pending" (require admin approval)
    const status =
      role === "tutor" && !invitation ? "pending" : "active";

    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        role: role as "student" | "tutor",
        status: status as "active" | "pending",
      })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

    // Mark invitation as accepted
    if (invitation) {
      await db
        .update(tutorInvitations)
        .set({
          status: "accepted",
          inviteeId: user.id,
          acceptedAt: new Date(),
        })
        .where(eq(tutorInvitations.id, invitation.id));
    }

    log.info("User registered", { userId: user.id, role, email });

    // Send welcome / application emails (non-fatal)
    try {
      const { EmailService } = await import("@/services/email.service");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

      if (role === "student") {
        await EmailService.welcomeEmail(user.email, { name: user.name ?? "there" });
      } else if (role === "tutor") {
        // Notify admin of new tutor application
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          await EmailService.newTutorApplication(adminEmail, {
            applicantName:  user.name ?? "Unknown",
            applicantEmail: user.email,
          });
        }
      }
    } catch (emailErr) {
      log.warn("Registration email failed", { emailErr });
    }

    return createdResponse(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      status === "pending"
        ? "Account created — your tutor application is under review."
        : "Account created successfully."
    );
  } catch (error) {
    log.error("Registration error", { error });
    return serverError();
  }
}
