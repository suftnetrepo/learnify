import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createConnectAccount, createConnectAccountLink } from "@/lib/stripe";
import {
  successResponse, unauthorized, forbidden, serverError,
} from "@/lib/api-response";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "tutor") {
      return forbidden("Only tutors can connect a Stripe account.");
    }

    const tutorId = session.user.id;

    // Fetch full user record
    const [tutor] = await db
      .select({
        id:              users.id,
        email:           users.email,
        stripeAccountId: users.stripeAccountId,
        stripeOnboardingStatus: users.stripeOnboardingStatus,
      })
      .from(users)
      .where(eq(users.id, tutorId))
      .limit(1);

    if (!tutor) return unauthorized();

    let stripeAccountId = tutor.stripeAccountId;

    // Create a new Connect account if not already created
    if (!stripeAccountId) {
      const account = await createConnectAccount(tutor.email!);
      stripeAccountId = account.id;

      await db
        .update(users)
        .set({
          stripeAccountId,
          stripeOnboardingStatus: "in_progress",
          updatedAt: new Date(),
        })
        .where(eq(users.id, tutorId));

      log.info("Stripe Connect account created", { tutorId, stripeAccountId });
    }

    // Generate a fresh onboarding link (they expire after use)
    const onboardingUrl = await createConnectAccountLink(stripeAccountId, tutorId);

    return successResponse({ url: onboardingUrl }, "Onboarding link created");
  } catch (error) {
    log.error("POST /api/stripe/connect error", { error });
    return serverError("Failed to create Stripe Connect account.");
  }
}

// GET — fetch current Connect account status
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "tutor") return forbidden();

    const [tutor] = await db
      .select({
        stripeAccountId:        users.stripeAccountId,
        stripeOnboardingStatus: users.stripeOnboardingStatus,
        stripePayoutsEnabled:   users.stripePayoutsEnabled,
        stripeChargesEnabled:   users.stripeChargesEnabled,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    return successResponse(tutor ?? {});
  } catch (error) {
    log.error("GET /api/stripe/connect error", { error });
    return serverError();
  }
}
