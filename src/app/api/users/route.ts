import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { UserService } from "@/services";
import { EmailService } from "@/services/email.service";
import { hashPassword } from "@/lib/utils";
import { z } from "zod";
import { successResponse, createdResponse, unauthorized, forbidden, serverError, validationError, conflict } from "@/lib/api-response";
import { log } from "@/lib/logger";

const querySchema = z.object({
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(100).default(20),
  role:   z.enum(["student","tutor","admin"]).optional(),
  status: z.enum(["active","pending","suspended"]).optional(),
  search: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const { searchParams } = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const result = await UserService.list(parsed.data);
    return successResponse(result);
  } catch (error) {
    log.error("GET /api/users", { error });
    return serverError();
  }
}

const createSchema = z.object({
  name:     z.string().min(1).max(100).trim(),
  email:    z.string().email().trim(),
  role:     z.enum(["student", "tutor", "admin"]),
  status:   z.enum(["active", "pending", "suspended"]).default("active"),
  password: z.string().min(8).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user)                return unauthorized();
    if (session.user.role !== "admin") return forbidden("Admins only");

    const body   = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    const { name, email, role, status, password } = parsed.data;

    const existing = await UserService.findByEmail(email);
    if (existing) return conflict("A user with this email already exists");

    const tempPassword = password ?? crypto.randomUUID().slice(0, 12);
    const passwordHash = await hashPassword(tempPassword);

    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash, role, status })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role, status: users.status });

    log.info("User created by admin", { userId: user.id, role, by: session.user.id });

    // Notify the new user with their login details — non-fatal if it fails
    await EmailService.adminInvitation(email, {
      inviterName:  session.user.name ?? "Platform Admin",
      loginUrl:     `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      tempPassword,
    }).catch(() => {});

    return createdResponse(user);
  } catch (error) {
    log.error("POST /api/users", { error });
    return serverError();
  }
}
