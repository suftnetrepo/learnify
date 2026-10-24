import { auth } from "@/lib/auth";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import { successResponse, unauthorized, forbidden, serverError } from "@/lib/api-response";
import { log } from "@/lib/logger";

/**
 * GET /api/ai-pass/admin/issues — admins only: StudyMind revocations that keep failing and paid
 * checkouts that need a refund or review. Available whether or not the feature flag is on.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();
    return successResponse(await AiTutorPassService.adminIssues());
  } catch (error) {
    log.error("AI Tutor Pass admin issues failed", { error });
    return serverError();
  }
}
