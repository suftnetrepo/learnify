import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAiTutorPassEnabled } from "@/lib/flags";
import { aiPassPriceId, AI_PASS } from "@/lib/ai-pass/config";
import { AI_PASS_TERMS } from "@/lib/ai-pass/terms";
import { createAiPassCheckoutSession } from "@/lib/stripe";
import { rateLimit } from "@/lib/rate-limit";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import {
  successResponse, unauthorized, forbidden, notFound, conflict, tooManyRequests, validationError, errorResponse, serverError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

const schema = z.object({
  courseId:        z.string().uuid(),
  // Explicit (never pre-ticked) acceptance of the AI Tutor Pass Terms, for the version on screen
  acceptTerms:     z.literal(true),
  termsVersion:    z.string().min(1).max(32),
  // Separate, optional request for immediate access (affects cancellation rights — see the Terms).
  // Must be sent explicitly; nothing is assumed.
  immediateAccess: z.boolean(),
});

/**
 * POST /api/ai-pass/checkout { courseId, acceptTerms: true, termsVersion, immediateAccess }
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

    const { courseId, termsVersion, immediateAccess } = parsed.data;
    if (termsVersion !== AI_PASS_TERMS.version) {
      return errorResponse("The AI Tutor Pass terms have been updated. Please review them and try again.", "TERMS_OUTDATED", 409);
    }
    if (AI_PASS_TERMS.immediateAccessAckRequired && !immediateAccess) {
      return validationError({ immediateAccess: ["Immediate access must be requested to buy a pass"] });
    }
    if (!(await AiTutorPassService.isEnrolledInFreeCourse(session.user.id, courseId))) {
      return forbidden("The AI Tutor Pass is for free courses you're enrolled in");
    }
    // Reserves a slot (one active + two queued, counting checkouts that may still be paid) and
    // expires this student's previous open checkout, so a second tab can't pay past the limit
    const consentAt = new Date();
    const result = await AiTutorPassService.startCheckout(
      session.user.id,
      { termsVersion, consentAt, immediateAccess },
      (opts) => createAiPassCheckoutSession({
        priceId,
        studentId:       session.user.id,
        studentEmail:    session.user.email,
        returnCourseId:  courseId,
        consentAt:       consentAt.toISOString(),
        termsVersion,
        immediateAccess: opts.immediateAccess,
      }),
    );
    if ("full" in result) {
      return conflict(`You already have an active pass and ${AI_PASS.maxQueued} upcoming passes`);
    }
    log.info("AI Tutor Pass checkout created", { checkoutSessionId: result.session.id, studentId: session.user.id });
    return successResponse({ url: result.session.url });
  } catch (error) {
    log.error("AI Tutor Pass checkout failed", { error });
    return serverError("Couldn't start checkout. Please try again.");
  }
}
