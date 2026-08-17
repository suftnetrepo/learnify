import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { successResponse, serverError, validationError, tooManyRequests, errorResponse } from "@/lib/api-response";
import { limiters, getClientIp } from "@/lib/rate-limit";
import { verifyRecaptcha } from "@/lib/recaptcha/verify";
import { log } from "@/lib/logger";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 requests per IP per hour
    const limit = limiters.passwordReset(getClientIp(req));
    if (!limit.success) return tooManyRequests("Too many reset requests — please wait before trying again");

    const body   = await req.json();

    // Verify reCAPTCHA token
    const captcha = await verifyRecaptcha(body.recaptchaToken);
    if (!captcha.success) {
      return errorResponse("Security check failed. Please try again.", "CAPTCHA_FAILED", 400);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string,string[]>);

    const { email } = parsed.data;

    // Always return success — never reveal whether email exists (prevents enumeration)
    const [user] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      const token    = crypto.randomBytes(32).toString("hex");
      const expires  = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db
        .update(users)
        .set({ passwordResetToken: token, passwordResetExpires: expires })
        .where(eq(users.id, user.id));

      // Send reset email
      try {
        const { EmailService } = await import("@/services/email.service");
        const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const resetUrl = `${appUrl}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
        await EmailService.passwordReset(email, { name: user.name ?? "there", resetUrl });
      } catch (emailErr) {
        log.warn("Password reset email failed", { emailErr });
      }

      log.info("Password reset requested", { userId: user.id });
    }

    // Always return the same message
    return successResponse(null, "If an account exists for that email, you'll receive a reset link shortly.");
  } catch (error) {
    log.error("POST /api/auth/forgot-password", { error });
    return serverError();
  }
}
