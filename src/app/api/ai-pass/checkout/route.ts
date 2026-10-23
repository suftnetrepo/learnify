import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAiTutorPassEnabled } from "@/lib/flags";
import { aiPassPriceId, AI_PASS } from "@/lib/ai-pass/config";
import { createAiPassCheckoutSession } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import {
  successResponse, unauthorized, forbidden, notFound, conflict, tooManyRequests, validationError, errorResponse, serverError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

const schema = z.object({
  courseId: z.string().uuid(),
  // UK digital content: explicit request for immediate access + acknowledgement of losing the
  // 14-day cancellation right once used. Wording in AiTutorPassCard — pending legal review.
  consent:  z.literal(true),
});

/**
 * POST /api/ai-pass/checkout { courseId, consent: true }
 * Starts a one-time Stripe Checkout for the AI Tutor Pass. Grants nothing by itself — the pass is
 * created only from a verified, paid Checkout Session (webhook or /api/ai-pass/confirm).
 */
export async function POST(req: NextRequest) {
  if (!isAiTutorPassEnabled()) return notFound();
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "student") return forbidden("Only students can buy an AI Tutor Pass");

    const limited = rateLimit("ai-pass-checkout", session.user.id, { limit: 5, windowMs: 10 * 60_000 });
    if (!limited.success) return tooManyRequests();

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const priceId = aiPassPriceId();
    if (!priceId) return errorResponse("The AI Tutor Pass isn't available right now", "NOT_CONFIGURED", 503);

    const { courseId } = parsed.data;
    if (!(await AiTutorPassService.isEnrolledInFreeCourse(session.user.id, courseId))) {
      return forbidden("The AI Tutor Pass is for free courses you're enrolled in");
    }
    const queued = await AiTutorPassService.queuedPasses(session.user.id);
    if (queued.length >= AI_PASS.maxQueued) {
      return conflict(`You already have ${AI_PASS.maxQueued} upcoming passes`);
    }

    const checkout = await createAiPassCheckoutSession({
      priceId,
      studentId:      session.user.id,
      studentEmail:   session.user.email,
      returnCourseId: courseId,
      consentAt:      new Date().toISOString(),
    });
    log.info("AI Tutor Pass checkout created", { checkoutSessionId: checkout.id, studentId: session.user.id });
    return successResponse({ url: checkout.url });
  } catch (error) {
    log.error("AI Tutor Pass checkout failed", { error });
    return serverError("Couldn't start checkout. Please try again.");
  }
}
