import { stripe } from "./client";
import { calculatePlatformFee } from "@/lib/utils";
import type Stripe from "stripe";

// ─── Checkout ─────────────────────────────────────────────────────────────────

interface CreateCheckoutSessionParams {
  courseId:         string;
  courseTitle:      string;
  courseSlug:       string;
  priceInPounds:    number;       // e.g. 149.00
  studentId:        string;
  studentEmail:     string;
  tutorStripeId:    string | null; // Connected account ID
  thumbnailUrl?:    string | null;
  sessionId?:       string;
}

export async function createCheckoutSession({
  courseId,
  courseTitle,
  courseSlug,
  priceInPounds,
  studentId,
  studentEmail,
  tutorStripeId,
  thumbnailUrl,
  sessionId,
}: CreateCheckoutSessionParams): Promise<Stripe.Checkout.Session> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  // Convert to pence (Stripe works in smallest currency unit)
  const amountPence      = Math.round(priceInPounds * 100);
  const { platformFee }  = calculatePlatformFee(priceInPounds);
  const platformFeePence = Math.round(platformFee * 100);

  // This account has Managed Payments enabled by default, which (a) owns
  // payment-method selection itself — passing payment_method_types is
  // rejected as unsupported — and (b) requires a Stripe tax code on every
  // line item's product, which this app doesn't track. Rather than assign
  // tax codes to ad-hoc price_data line items, we opt this session out of
  // Managed Payments entirely, as Stripe's own error message recommends.
  // `managed_payments` isn't in the installed stripe SDK's types yet
  // (22.5.0, currently latest on npm) even though the live API already
  // expects it, hence the local type extension.
  // https://docs.stripe.com/payments/managed-payments/update-checkout#remove-unsupported-parameters
  const sessionParams: Stripe.Checkout.SessionCreateParams & { managed_payments?: { enabled: boolean } } = {
    mode:               "payment",
    managed_payments:   { enabled: false },
    customer_email:     studentEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency:     "gbp",
          unit_amount:  amountPence,
          product_data: {
            name:   courseTitle,
            images: thumbnailUrl ? [thumbnailUrl] : [],
          },
        },
      },
    ],
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/checkout/cancel?courseId=${courseId}`,
    metadata: {
      courseId,
      courseSlug,
      studentId,
      ...(sessionId ? { sessionId } : {}),
    },
    // Collect billing address for tax/compliance
    billing_address_collection: "required",
    // Allow promo codes
    allow_promotion_codes: true,
  };

  // If the tutor has a connected Stripe account, route payment through Connect
  if (tutorStripeId) {
    sessionParams.payment_intent_data = {
      application_fee_amount: platformFeePence,
      transfer_data: {
        destination: tutorStripeId,
      },
    };
  }

  return stripe.checkout.sessions.create(sessionParams);
}

// ─── Connect onboarding ───────────────────────────────────────────────────────

export async function createConnectAccountLink(
  stripeAccountId: string,
  tutorId:         string
): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const link = await stripe.accountLinks.create({
    account:     stripeAccountId,
    refresh_url: `${appUrl}/instructor/onboarding?refresh=1&tutorId=${tutorId}`,
    return_url:  `${appUrl}/instructor/onboarding/complete`,
    type:        "account_onboarding",
  });

  return link.url;
}

export async function createConnectAccount(email: string): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type:              "express",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers:     { requested: true },
    },
    business_type: "individual",
    settings: {
      payouts: {
        schedule: { interval: "weekly", weekly_anchor: "friday" },
      },
    },
  });
}

export async function getConnectAccount(
  accountId: string
): Promise<Stripe.Account> {
  return stripe.accounts.retrieve(accountId);
}

// ─── Webhook verification ─────────────────────────────────────────────────────

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret:    string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

// ─── Refunds ─────────────────────────────────────────────────────────────────

export async function refundPayment(
  paymentIntentId: string,
  reason?:         Stripe.RefundCreateParams.Reason
): Promise<Stripe.Refund> {
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    reason,
  });
}
