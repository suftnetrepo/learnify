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

// ─── AI Tutor Pass ───────────────────────────────────────────────────────────

/**
 * One-time Checkout for the AI Tutor Pass — platform revenue (no Connect transfer), the dedicated
 * Stripe Price (amount/currency re-validated at fulfilment), card payments only, no promotion codes. Managed Payments
 * is disabled, consistent with course checkout. Metadata is set on both the Session and the
 * PaymentIntent so refund and dispute events can be matched back to the pass.
 */
export async function createAiPassCheckoutSession({
  priceId, studentId, studentEmail, returnCourseId, consentAt, termsVersion, immediateAccess,
}: {
  priceId:         string;
  studentId:       string;
  studentEmail:    string | null | undefined;
  returnCourseId:  string;
  consentAt:       string;    // ISO time the student accepted the terms
  termsVersion:    string;    // AI Tutor Pass terms version accepted
  immediateAccess: boolean;   // optional request for immediate access (cancellation-rights acknowledgement)
}): Promise<Stripe.Checkout.Session> {
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL!;
  const metadata = { app: "learnify", kind: "ai_tutor_pass", student_id: studentId };
  const params: Stripe.Checkout.SessionCreateParams & { managed_payments?: { enabled: boolean } } = {
    mode:                  "payment",
    managed_payments:      { enabled: false },
    // Cards only for launch (wallets such as Apple Pay / Google Pay are card payments). Keeps
    // refunds/disputes on the tested path — no delayed or buy-now-pay-later methods.
    payment_method_types:  ["card"],
    line_items:            [{ price: priceId, quantity: 1 }],
    client_reference_id:   studentId,
    ...(studentEmail ? { customer_email: studentEmail } : {}),
    allow_promotion_codes: false,
    billing_address_collection: "required",
    metadata: {
      ...metadata, consent_at: consentAt, terms_version: termsVersion,
      immediate_access: immediateAccess ? "true" : "false", return_course_id: returnCourseId,
    },
    payment_intent_data:   { metadata },
    expires_at:            Math.floor(Date.now() / 1000) + 60 * 60,   // 1 hour (Stripe allows 30 min – 24 h)
    custom_text: {
      submit: {
        message: "One-time payment — not a subscription and it won't renew. Your 30-day AI Tutor Pass starts " +
                 "straight away, or when your current pass ends if you already have one.",
      },
    },
    success_url: `${appUrl}/learn/${returnCourseId}?ai_pass=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/learn/${returnCourseId}?ai_pass=cancelled`,
  };
  return stripe.checkout.sessions.create(params);
}
