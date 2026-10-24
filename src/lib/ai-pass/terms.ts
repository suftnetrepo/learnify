/**
 * AI Tutor Pass customer terms — the single source for the Terms page, the purchase consent, the
 * Stripe metadata and the confirmation email, so they can't drift apart. Every purchase records
 * the `version` the student accepted.
 *
 * DRAFT — NOT LEGALLY APPROVED. Pending professional legal and tax review
 * (docs/ai-tutor-pass-customer-wording-DRAFT.md). Bump `version` whenever the wording changes.
 */
import { AI_PASS } from "./config";

export const AI_PASS_TERMS = {
  version:      "2026-10-24-draft.1",
  approved:     false,
  path:         "/terms/ai-tutor-pass",
  supportEmail: "info@suftnet.com",
  /**
   * Tax statement for the price and the email. Null until tax review decides it — nothing about
   * VAT is claimed meanwhile.
   */
  taxNote:      null as string | null,
  /**
   * Whether the immediate-access acknowledgement is required to buy. Off: it's an explicit,
   * optional choice and statutory cancellation rights are never removed automatically.
   */
  immediateAccessAckRequired: false,
} as const;

/** Shown next to the optional checkbox, stored with the purchase and quoted in the email. */
export const IMMEDIATE_ACCESS_ACK_TEXT =
  "I ask for my AI Tutor Pass to start immediately, within the 14-day cancellation period. " +
  "I understand this affects my right to cancel, as explained in the AI Tutor Pass Terms.";

export const price = () => `£${(AI_PASS.pricePence / 100).toFixed(2)}`;

export interface TermsSection { id: string; heading: string; paragraphs: string[] }

const a = AI_PASS.allowances;

export const AI_PASS_TERMS_SECTIONS: TermsSection[] = [
  {
    id: "what-it-is",
    heading: "1. What the AI Tutor Pass is",
    paragraphs: [
      `The AI Tutor Pass is a one-time digital purchase of ${price()} that gives you access to the AI tutor on the free Edquis courses you are enrolled in, for ${AI_PASS.durationDays} consecutive days.`,
      "It is not a subscription and it does not renew automatically. You are only charged when you choose to buy a pass.",
      "Paid courses already include the AI tutor, so you don't need a pass for them.",
    ],
  },
  {
    id: "price",
    heading: "2. Price",
    paragraphs: [
      `The price is ${price()}, paid once by card at checkout. The amount shown at checkout is the amount you pay.`,
    ],
  },
  {
    id: "access",
    heading: "3. When your access starts and ends",
    paragraphs: [
      `If you don't have a pass, your pass starts as soon as your payment is confirmed and lasts ${AI_PASS.durationDays} consecutive days (${AI_PASS.durationDays} × 24 hours). The exact end date and time are shown in the AI tutor and in your confirmation email.`,
      "If you already have a pass, a new pass is queued: it starts automatically when your latest pass ends, so you never lose days. Its start date is shown before you pay and in your confirmation email.",
      `You can hold one active pass and up to ${AI_PASS.maxQueued} upcoming passes. If a payment arrives after you have reached this limit (for example, from a second browser tab), we refund it automatically and no pass is added.`,
    ],
  },
  {
    id: "allowances",
    heading: "4. Daily allowances",
    paragraphs: [
      `Each day you can ask up to ${a.chat} AI tutor questions and create up to ${a.quiz} quizzes, ${a.flashcards} flashcard sets and ${a.summary} summaries.`,
      "These allowances are shared across all the free courses you're enrolled in — they are not per course.",
      "Allowances reset at midnight UK time. Unused allowances don't carry over to the next day.",
    ],
  },
  {
    id: "fair-use",
    heading: "5. Fair-use limit for each pass",
    paragraphs: [
      "The AI Tutor Pass is not unlimited. As well as the daily allowances, each pass includes a total fair-use limit on AI usage for its whole 30 days. Long or complex requests use more of it than short ones.",
      "If you reach the fair-use limit, the AI tutor stops working on that pass — even if days remain and you haven't used today's allowances. It does not reset at midnight. The AI tutor tells you when this happens.",
      "Any pass you have queued still starts on its scheduled date, which is when your current pass's 30 days end.",
    ],
  },
  {
    id: "cancellation",
    heading: "6. Your right to cancel",
    paragraphs: [
      "As a consumer in the UK you normally have a right to cancel an online purchase within 14 days. How that right applies to the AI Tutor Pass depends on what you choose at checkout:",
      "If you do NOT ask for immediate access: your pass still starts straight away, and you can cancel within 14 days of your purchase by contacting us. [LEGAL REVIEW: full refund, or a deduction for the access already provided.]",
      "If you DO ask for immediate access and acknowledge the effect on your cancellation rights: [LEGAL REVIEW: depending on whether the pass is digital content or a digital service, you either lose the right to cancel once access begins, or you may still cancel within 14 days but pay for the access you have used.]",
      "A queued pass that hasn't started yet can be cancelled for a full refund before its start date. [PROPOSED POLICY — business and legal approval required.]",
      "Your choice and the time you made it are recorded with your purchase and shown in your confirmation email.",
    ],
  },
  {
    id: "refunds",
    heading: "7. Refunds",
    paragraphs: [
      `To request a cancellation or refund, email ${AI_PASS_TERMS.supportEmail} from your account's email address with the date of your purchase.`,
      "Refunds go back to the card you paid with, usually within 5–10 business days.",
      "When a pass is fully refunded, its access ends immediately. If we make a partial refund (for example, as a goodwill gesture), your pass continues.",
    ],
  },
  {
    id: "faulty",
    heading: "8. If the service is faulty or unavailable",
    paragraphs: [
      "Your statutory rights are not affected. If the AI tutor does not work as described, contact us and we will put it right or, where that isn't possible, give you an appropriate refund. [LEGAL REVIEW: remedies under the Consumer Rights Act 2015 for digital content or services.]",
      "If the AI tutor is unavailable for a significant part of your pass because of a problem on our side, contact us. [PROPOSED POLICY: extend the pass or refund the affected days.]",
      "AI answers can be inaccurate or incomplete. Use them to support your learning and check important information against your course materials.",
    ],
  },
  {
    id: "disputes",
    heading: "9. Payment disputes and chargebacks",
    paragraphs: [
      "If something is wrong with your purchase, please contact us first — we can usually resolve it quickly.",
      "If you open a payment dispute or chargeback with your card provider, access for that pass is suspended while the dispute is open, and it is not restored automatically when the dispute closes. Contact us if you think this is a mistake.",
    ],
  },
  {
    id: "courses",
    heading: "10. How the pass relates to course purchases",
    paragraphs: [
      "The AI Tutor Pass is a separate purchase from courses. It doesn't change any course you have bought or that course's terms, including the course 30-day money-back guarantee, which applies to courses and not to AI Tutor Passes.",
      "If you bought a course that later became free, you keep its AI tutor without needing a pass.",
    ],
  },
  {
    id: "changes",
    heading: "11. Changes to these terms",
    paragraphs: [
      "We may update these terms. Each version has a version number, and the version you accepted applies to that purchase. Changes never apply retrospectively to a pass you have already bought.",
    ],
  },
  {
    id: "contact",
    heading: "12. Contact",
    paragraphs: [`Questions about your AI Tutor Pass: ${AI_PASS_TERMS.supportEmail}.`],
  },
];
