import { NextRequest } from "next/server";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import { successResponse, unauthorized, serverError } from "@/lib/api-response";

/**
 * GET /api/cron/ai-pass-revocations — retries StudyMind revocations for refunded/disputed passes,
 * refunds owed for rejected payments and pending purchase confirmation emails (Bearer CRON_SECRET, like /api/cron/email). Idempotent and
 * safe to run concurrently; the Learnify pass is already revoked.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return unauthorized();
  try {
    const revocations = await AiTutorPassService.processPendingRevocations({ limit: 100 });
    const refunds     = await AiTutorPassService.processPendingRefunds({ limit: 50 });
    const emails      = await AiTutorPassService.processPendingConfirmationEmails({ limit: 50 });
    return successResponse({ revocations, refunds, emails });
  } catch {
    return serverError("AI Tutor Pass revocation retry failed");
  }
}
