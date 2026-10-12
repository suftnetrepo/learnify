import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { TRANQUIS_PLANS, type TransquisPlanId } from "@/lib/tranquis-plans";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const PRICE_ID_MAP: Record<TransquisPlanId, string | undefined> = {
  weekly:    process.env.TRANQUIS_STRIPE_WEEKLY_PRICE_ID,
  monthly:   process.env.TRANQUIS_STRIPE_MONTHLY_PRICE_ID,
  quarterly: process.env.TRANQUIS_STRIPE_QUARTERLY_PRICE_ID,
  annual:    process.env.TRANQUIS_STRIPE_ANNUAL_PRICE_ID,
};

const VALID_PLAN_IDS = TRANQUIS_PLANS.map((p) => p.id) as [TransquisPlanId, ...TransquisPlanId[]];

const schema = z.object({
  planId: z.enum(VALID_PLAN_IDS),
  userId: z.string().min(1, "userId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { planId, userId } = parsed.data;

    const priceId = (PRICE_ID_MAP as Record<string, string | undefined>)[planId];
    if (!priceId) {
      log.error("Tranquis: missing Stripe price ID for plan", { planId });
      return NextResponse.json(
        { error: `Stripe price not configured for plan: ${planId}` },
        { status: 500 }
      );
    }

    const plan = TRANQUIS_PLANS.find((p) => p.id === planId)!;

    const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode:     "subscription",
      line_items: [
        {
          price:    priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/subscribe/tranquis/success?session_id={CHECKOUT_SESSION_ID}&plan=${planId}`,
      cancel_url:  `${appUrl}/subscribe/tranquis?user_id=${userId}`,
      client_reference_id: userId,
      metadata: {
        tranquis_user_id: userId,
        plan_id:          planId,
        app:              "tranquis",
      },
      ...(plan.trial && "trialDays" in plan
        ? { subscription_data: { trial_period_days: plan.trialDays } }
        : {}),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    log.info("Tranquis: checkout session created", { sessionId: session.id, planId, userId });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error("Tranquis: POST /api/tranquis/subscribe error", { error: msg });
    return NextResponse.json({ error: "Failed to create checkout session", detail: msg }, { status: 500 });
  }
}
