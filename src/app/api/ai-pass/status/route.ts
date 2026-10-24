import { auth } from "@/lib/auth";
import { isAiTutorPassEnabled } from "@/lib/flags";
import { AI_PASS } from "@/lib/ai-pass/config";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import { successResponse, unauthorized, serverError } from "@/lib/api-response";
import { log } from "@/lib/logger";

/**
 * GET /api/ai-pass/status — the caller's own pass: current period, queued passes, and (once the
 * pass has been used) live allowances from StudyMind. Never exposes other students' passes.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const offer = {
      pricePence:   AI_PASS.pricePence,
      currency:     AI_PASS.currency,
      durationDays: AI_PASS.durationDays,
      allowances:   AI_PASS.allowances,
      maxQueued:    AI_PASS.maxQueued,
    };
    if (!isAiTutorPassEnabled() || session.user.role !== "student") {
      return successResponse({ enabled: false, offer });
    }
    return successResponse({ enabled: true, offer, ...(await AiTutorPassService.status(session.user.id)) });
  } catch (error) {
    log.error("AI Tutor Pass status failed", { error });
    return serverError();
  }
}
