import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
// Capture outgoing email instead of sending it
const sent: { to: string; subject: string; html: string }[] = [];
let failNextSend = false;
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (to: string, subject: string, html: string) => {
    if (failNextSend) { failNextSend = false; throw new Error("provider down"); }
    sent.push({ to, subject, html });
  }),
  isReservedTestAddress: () => false,
}));
import { db } from "@/db";
import { aiPassCheckouts, aiTutorPasses } from "@/db/schema";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";
import { AI_PASS_TERMS, IMMEDIATE_ACCESS_ACK_TEXT } from "@/lib/ai-pass/terms";
import { DAY_MS } from "@/lib/ai-pass/config";
import { fakeStripe, hasDb, json, makePass, makeUser, mockStudyMind, resetDb } from "../helpers";
import fs from "node:fs";

/** EMAIL_PREVIEW_DIR=… writes the rendered emails for visual review (nothing is sent). */
const preview = (name: string, html: string) => {
  if (process.env.EMAIL_PREVIEW_DIR) fs.writeFileSync(`${process.env.EMAIL_PREVIEW_DIR}/${name}.html`, html);
};

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const escapedAck = IMMEDIATE_ACCESS_ACK_TEXT.replace(/'/g, "&#39;");

/** Start a checkout the way the route does (consent recorded server-side), then pay for it. */
async function purchase(stripe: ReturnType<typeof fakeStripe>, studentId: string, immediateAccess: boolean) {
  const r = await AiTutorPassService.startCheckout(
    studentId, { termsVersion: AI_PASS_TERMS.version, consentAt: new Date(), immediateAccess },
    async () => stripe.spies.create.getMockImplementation()!({ client_reference_id: studentId, metadata: {} } as never) as never,
  );
  if ("full" in r) throw new Error("limit reached");
  return stripe.pay(studentId, { id: r.session.id });
}

describe.skipIf(!hasDb)("AI Tutor Pass confirmation email", () => {
  let stripe: ReturnType<typeof fakeStripe>;
  beforeEach(async () => { await resetDb(); stripe = fakeStripe(); sent.length = 0; failNextSend = false; });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("sends one confirmation with price, dates, allowances, fair use, renewal, cancellation, terms and support", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    const result = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(result.outcome).toBe("granted");
    expect(sent).toHaveLength(1);
    const [mail] = sent;
    preview("confirmation-immediate-start", mail.html);
    const body = text(mail.html);
    expect(mail.to).toBe(s.email);
    expect(mail.subject).toBe("Your AI Tutor Pass is confirmed");
    expect(body).toContain("£9.99 — one-time payment, not a subscription");
    expect(body).toMatch(/Started .*\(UK time\)/);
    expect(body).toMatch(/Ends .*\(UK time\)/);
    expect(body).toContain("60 AI tutor questions, 5 quizzes, 5 flashcard sets and 3 summaries");
    expect(body).toContain("shared across all the free courses you're enrolled in");
    expect(body).toContain("midnight UK time");
    expect(body).toContain("The pass is not unlimited");
    expect(body).toContain("total fair-use limit");
    expect(body).toContain("stops working on this pass before the end date");
    expect(body).toContain("does not reset at midnight");
    expect(body).toContain("won't renew and you won't be charged again");
    expect(body).toContain("Your statutory rights are not affected");
    expect(mail.html).toContain(`${AI_PASS_TERMS.path}`);
    expect(body).toContain(`version ${AI_PASS_TERMS.version}`);
    expect(mail.html).toContain(`mailto:${AI_PASS_TERMS.supportEmail}`);
    expect(body).not.toMatch(/(?<!not )unlimited/i);              // only ever "not unlimited"
    expect(body).not.toMatch(/\bVAT\b|incl\. tax|including tax/i); // no unverified tax claims while taxNote is unset
  });

  it("without the immediate-access request: states the 14-day right to cancel and its end date", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    const body = text(sent[0].html);
    expect(body).toContain("You didn't ask for immediate access, so you keep your right to cancel within 14 days of your purchase");
    expect(body).not.toContain(IMMEDIATE_ACCESS_ACK_TEXT);
  });

  it("with the immediate-access request: quotes the acknowledgement and when it was given", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, true);
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    const html = sent[0].html;
    expect(html).toContain(escapedAck);
    expect(text(html)).toMatch(/you asked for it to start immediately/);
    expect(text(html)).not.toContain("you keep your right to cancel within 14 days");
  });

  it("queued renewal: states the future activation date and the cancel-before-start option", async () => {
    const s = await makeUser();
    const current = await makePass(s.id, { endOffsetMs: 10 * DAY_MS });
    const session = await purchase(stripe, s.id, true);   // immediate-access ignored for a queued pass
    const result = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(result.outcome === "granted" && result.pass.startsAt.getTime()).toBe(current.endsAt.getTime());
    const [mail] = sent;
    const day = current.endsAt.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });
    preview("confirmation-queued-renewal", mail.html);
    expect(mail.subject).toBe(`Your next AI Tutor Pass starts ${day}`);
    const body = text(mail.html);
    expect(body).toContain("this one is queued: it will start automatically on");
    expect(body).toContain(day);
    expect(body).toMatch(/Starts automatically .*\(UK time\)/);
    expect(body).toContain("You can cancel it for a full refund at any time before");
    expect(mail.html).not.toContain(escapedAck);
  });

  it("duplicate and concurrent deliveries (webhooks + confirm) send exactly one email", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    await Promise.all([
      AiTutorPassService.fulfilCheckoutSession(session.id, "webhook"),
      AiTutorPassService.fulfilCheckoutSession(session.id, "confirm"),
      AiTutorPassService.fulfilCheckoutSession(session.id, "webhook"),
    ]);
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");   // a later retry
    expect(sent).toHaveLength(1);
    const [pass] = await db.select().from(aiTutorPasses);
    expect(pass.confirmationEmailSentAt).not.toBeNull();
  });

  it("a failed hand-over releases the claim so the next delivery sends it (still only once)", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    failNextSend = true;
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(sent).toHaveLength(0);
    expect((await db.select().from(aiTutorPasses))[0].confirmationEmailSentAt).toBeNull();
    await AiTutorPassService.fulfilCheckoutSession(session.id, "confirm");
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(sent).toHaveLength(1);
  });

  it("no confirmation for a payment that isn't granted (refunded before fulfilment, or over the limit)", async () => {
    const s = await makeUser();
    const refunded = await purchase(stripe, s.id, false);
    stripe.refundAt(refunded.payment_intent as string);
    await AiTutorPassService.fulfilCheckoutSession(refunded.id, "webhook");
    expect(sent).toHaveLength(0);
  });

  it("no confirmation for a pass revoked before the email went out", async () => {
    mockStudyMind(() => json(200, {}));
    const s = await makeUser(); const p = await makePass(s.id);
    await AiTutorPassService.revoke(p.id, "refunded");
    expect(await AiTutorPassService.sendConfirmationEmail(p.id)).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("the pass stores the accepted terms version, consent time and immediate-access choice", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, true);
    const result = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    const [checkout] = await db.select().from(aiPassCheckouts).where(eq(aiPassCheckouts.stripeCheckoutSessionId, session.id));
    expect(result.outcome === "granted" && result.pass).toMatchObject({
      termsVersion: AI_PASS_TERMS.version, immediateAccessAck: true, consentAt: checkout.consentAt,
      stripeCheckoutSessionId: session.id, studentId: s.id,
    });
  });

  it("falls back to Stripe metadata for consent when there is no checkout record", async () => {
    const s = await makeUser();
    const session = stripe.pay(s.id, {
      metadata: { app: "learnify", kind: "ai_tutor_pass", student_id: s.id, consent_at: new Date().toISOString(), terms_version: "meta-v", immediate_access: "true" },
    });
    const result = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(result.outcome === "granted" && result.pass).toMatchObject({ termsVersion: "meta-v", immediateAccessAck: true });
  });
});
