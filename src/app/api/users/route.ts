import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { UserService } from "@/services";
import { z } from "zod";
import { successResponse, unauthorized, forbidden, serverError, validationError } from "@/lib/api-response";
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
