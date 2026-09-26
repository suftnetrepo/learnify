import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { forbidden, notFound, successResponse, unauthorized } from "@/lib/api-response";
import { SessionService } from "@/services/session.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const account = await auth();
  if (!account?.user) return unauthorized();
  if (account.user.role !== "tutor" && account.user.role !== "admin") return forbidden();

  const { id } = await params;
  const result = await SessionService.getInstructorJoinLink(id, account.user.id, account.user.role === "admin");
  if (!result) return notFound("Session");
  if (!result.allowed) return forbidden(result.message);
  return successResponse({ url: result.url });
}
