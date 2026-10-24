/**
 * AI Tutor Pass customer terms — the single source for the Terms page, the purchase consent, the
 * Stripe metadata and the confirmation email, so they can't drift apart. Every purchase records
 * the `version` the student accepted.
 *
 * Cancellation and refund terms are set conservatively: under either reading of the pass (digital
 * content or digital service) customers get at least their statutory rights. Seller details and
 * VAT status confirmed by the business (company verified on Companies House, 2026-10-24).
 * Bump `version` whenever the wording changes.
 */
import { AI_PASS } from "./config";

export const AI_PASS_TERMS = {
  version:      "2026-10-24.1",
  approved:     true,
  path:         "/terms/ai-tutor-pass",
  supportEmail: "info@suftnet.com",
  /**
   * Trader identity required in the terms (Consumer Contracts Regulations 2013). The seller is
   * Suftnet Limited; Edquis is the product brand. Verified on Companies House (active, 2026-10-24).
   */
  trader: {
    name:            "Suftnet Limited",
    brand:           "Edquis",
    town:            "Peterborough, England",
    companyNumber:   "07746154" as string | null,
    registeredOffice: "The Gatehouse, 453 Cranbrook Road, Ilford, Essex, IG2 6EW, United Kingdom" as string | null,
  },
  /** Tax statement shown with the price, in the terms and in the email (confirmed: not VAT-registered). */
  taxNote:      "No VAT is charged — Suftnet Limited is not registered for VAT." as string | null,
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

const t = AI_PASS_TERMS.trader;
const traderLine = [
  `${t.name} (trading as ${t.brand})`,
  t.companyNumber ? `company number ${t.companyNumber}` : "[COMPANY NUMBER — TO BE CONFIRMED]",
  t.registeredOffice ? `registered office ${t.registeredOffice}` : `[REGISTERED OFFICE ADDRESS — TO BE CONFIRMED] (${t.town})`,
].join(", ");

export const AI_PASS_TERMS_SECTIONS: TermsSection[] = [
  {
    id: "what-it-is",
    heading: "1. What the AI Tutor Pass is",
    paragraphs: [
      `The AI Tutor Pass is a one-time digital purchase of ${price()} that gives you access to the AI tutor on the free Edquis courses you are enrolled in, for ${AI_PASS.durationDays} consecutive days.`,
      "It is not a subscription and it does not renew automatically. You are only charged when you choose to buy a pass.",
      `The AI Tutor Pass is sold by ${t.name}, which operates ${t.brand}.`,
      "Paid courses already include the AI tutor, so you don't need a pass for them.",
    ],
  },
  {
    id: "who-can-buy",
    heading: "1A. Who can buy",
    paragraphs: [
      "The AI Tutor Pass is currently available to customers in the United Kingdom only. You need a UK billing address and a card issued in the UK.",
      "If a payment is made with a non-UK billing address or card, no pass is added and we refund the payment in full automatically.",
    ],
  },
  {
    id: "price",
    heading: "2. Price",
    paragraphs: [
      `The price is ${price()}, paid once by card at checkout. The amount shown at checkout is the amount you pay.`,
      ...(AI_PASS_TERMS.taxNote ? [AI_PASS_TERMS.taxNote] : []),
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
      "You can cancel any AI Tutor Pass within 14 days of the day you bought it by emailing us (see section 7). You don't need to give a reason. What you get back depends on the choice you made at checkout:",
      "If you did NOT ask for immediate access: we refund the full price. Your pass still starts straight away so you can use it while you decide.",
      "If you DID ask for immediate access and acknowledged the effect on your cancellation rights: we refund the price less a proportionate amount for the days of access you had before you told us you were cancelling (for example, cancelling on day 3 of 30 means we keep 3/30 of the price).",
      "If your pass is queued and hasn't started yet, cancelling at any time before its start date gets you a full refund.",
      "When you cancel, the cancelled pass ends immediately. Your choice at checkout and the time you made it are recorded with your purchase and shown in your confirmation email.",
      "These rights are in addition to your other legal rights, which are not affected.",
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
      "Your statutory rights under the Consumer Rights Act 2015 are not affected. If the AI tutor doesn't work as described, tell us and we will fix it within a reasonable time; if we can't, we will give you a full or partial refund.",
      "If the AI tutor is unavailable for more than 24 hours in total during your pass because of a problem on our side, we will extend your pass by the time lost or, if you prefer, refund that part of the price.",
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
    heading: "12. Who we are and how to contact us",
    paragraphs: [
      `These terms are between you and ${traderLine}.`,
      `Questions, cancellations or complaints about your AI Tutor Pass: ${AI_PASS_TERMS.supportEmail}.`,
    ],
  },
];
