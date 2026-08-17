import { NextRequest } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { successResponse, serverError, validationError, errorResponse } from "@/lib/api-response";
import { log } from "@/lib/logger";

const schema = z.object({
  token:    z.string().min(1),
  email:    z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one number"),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string,string[]>);

    const { token, email, password } = parsed.data;

    // Find user with valid, non-expired token
    const [user] = await db
      .select({ id: users.id, passwordResetExpires: users.passwordResetExpires })
      .from(users)
      .where(
        and(
          eq(users.email,              email),
          eq(users.passwordResetToken, token),
          gt(users.passwordResetExpires, new Date())
        )
      )
      .limit(1);

    if (!user) {
      return errorResponse(
        "This reset link is invalid or has expired. Please request a new one.",
        "INVALID_TOKEN",
        400
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db
      .update(users)
      .set({
        passwordHash,
        passwordResetToken:   null,
        passwordResetExpires: null,
        updatedAt:            new Date(),
      })
      .where(eq(users.id, user.id));

    log.info("Password reset completed", { userId: user.id });
    return successResponse(null, "Password updated successfully. You can now sign in.");
  } catch (error) {
    log.error("POST /api/auth/reset-password", { error });
    return serverError();
  }
}
