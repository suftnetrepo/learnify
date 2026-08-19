import { NextRequest } from "next/server";
import { registerSchema } from "@/lib/validations/auth";
import {
  createdResponse, errorResponse, conflict,
  serverError, validationError, tooManyRequests,
} from "@/lib/api-response";
import { limiters, getClientIp } from "@/lib/rate-limit";
import { verifyRecaptcha }        from "@/lib/recaptcha/verify";
import { UserService }             from "@/services";
import { log }                     from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const limit = limiters.register(getClientIp(req));
    if (!limit.success) return tooManyRequests();

    const body = await req.json();

    // reCAPTCHA
    const captcha = await verifyRecaptcha(body.recaptchaToken);
    if (!captcha.success) {
      return errorResponse("Security check failed. Please try again.", "CAPTCHA_FAILED", 400);
    }

    // Validate input
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    // Delegate entirely to UserService
    const result = await UserService.registerUser(parsed.data);

    if (!result.success) {
      if (result.code === "CONFLICT")            return conflict(result.message!);
      if (result.code === "INVALID_INVITATION")  return errorResponse(result.message!, result.code, 400);
      return serverError();
    }

    log.info("User registered", { userId: result.user!.id, role: parsed.data.role });

    return createdResponse(
      { id: result.user!.id, email: result.user!.email, name: result.user!.name, role: result.user!.role },
      result.status === "pending"
        ? "Account created — your tutor application is under review."
        : "Account created successfully."
    );
  } catch (error) {
    log.error("Registration error", { error });
    return serverError();
  }
}
