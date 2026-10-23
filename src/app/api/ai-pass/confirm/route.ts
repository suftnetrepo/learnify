import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAiTutorPassEnabled } from "@/lib/flags";
import { stripe } from "@/lib/stripe";
import { AiTutorPassService, PassFulfilmentError } from "@/services/ai-tutor-pass.service";
import { successResponse, unauthorized, forbidden, notFound, validationError, errorResponse, serverError } from "@/lib/api-response";
import { log } from "@/lib/logger";

const schema = z.object({ sessionId: z.string().min(10).max(255).startsWith("cs_") });

/**
 * POST /api/ai-pass/confirm { sessionId }
 * Called when the student returns from Checkout, in case the webhook hasn't arrived yet. The
 * session is re-read from Stripe (never trusted from the redirect) and must belong to the caller;
 * fulfilment is the same idempotent path the webhook uses.
 */
export async function POST(req: NextRequest) {
  if (!isAiTutorPassEnabled()) return notFound();
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);

    let checkout;
    try {
      checkout = await stripe.checkout.sessions.retrieve(parsed.data.sessionId);
    } catch {
      return notFound("Checkout session");
    }
    if (checkout.client_reference_id !== session.user.id || checkout.metadata?.student_id !== session.user.id) {
      return forbidden("This checkout belongs to someone else");
    }
    if (checkout.payment_status !== "paid") {
      return errorResponse("Payment hasn't completed yet", "PAYMENT_PENDING", 409);
    }

    try {
      await AiTutorPassService.fulfilCheckoutSession(checkout, "confirm");
    } catch (error) {
      if (error instanceof PassFulfilmentError) {
        log.error("AI Tutor Pass confirm rejected", { sessionId: checkout.id, reason: error.message });
        return errorResponse("This payment can't be used for an AI Tutor Pass", "INVALID_SESSION", 422);
      }
      throw error;
    }
    return successResponse(await AiTutorPassService.status(session.user.id));
  } catch (error) {
    log.error("AI Tutor Pass confirm failed", { error });
    return serverError();
  }
}
