/**
 * AI Tutor Pass — fixed commercial terms. StudyMind is the authority on usage (it enforces the
 * daily allowances and the $4.50 cost budget per pass); the allowances here are for display only.
 */
export const AI_PASS = {
  pricePence:   999,
  currency:     "gbp",
  durationDays: 30,
  maxQueued:    2,            // future (not yet started) passes a student may hold
  policyType:   "learnify_free_course_pass",
  allowances:   { chat: 60, quiz: 5, flashcards: 5, summary: 3 },
  /** StudyMind rejects token lifetimes below 300 s; it clamps a pass token to the pass end itself. */
  studymindMinTokenSeconds: 300,
  tokenTtlSeconds:          3600,
  /** A pass with this little time left counts as ended — no near-dead tokens. */
  minUsableSeconds:         5,
} as const;

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The dedicated Stripe Price for the pass. Unset = purchases unavailable (fail closed). */
export function aiPassPriceId(): string | null {
  return process.env.STRIPE_AI_PASS_PRICE_ID || null;
}

/** Stripe metadata marking a Checkout Session / PaymentIntent as an AI Tutor Pass purchase. */
export const AI_PASS_METADATA = { app: "learnify", kind: "ai_tutor_pass" } as const;
