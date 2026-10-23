import { NextRequest } from "next/server";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import { successResponse, unauthorized, serverError } from "@/lib/api-response";

/**
 * GET /api/cron/ai-pass-revocations — retries StudyMind revocations for refunded/disputed passes
 * (Bearer CRON_SECRET, like /api/cron/email). Idempotent; the Learnify pass is already revoked.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return unauthorized();
  try {
    return successResponse(await AiTutorPassService.processPendingRevocations({ limit: 100 }));
  } catch {
    return serverError("AI Tutor Pass revocation retry failed");
  }
}
