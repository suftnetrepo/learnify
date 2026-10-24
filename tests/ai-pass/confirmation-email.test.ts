import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
// Capture outgoing email instead of sending it. `provider` scripts the next deliveries' outcomes.
const sent: { to: string; subject: string; html: string; idempotencyKey?: string }[] = [];
const alerts: string[] = [];
let provider: ("ok" | "timeout" | "permanent" | "duplicate")[] = [];
vi.mock("@/lib/email", () => {
  class PermanentEmailError extends Error {}
  return {
    PermanentEmailError,
    isReservedTestAddress: () => false,
    // ops alerts and other mail go through sendEmail
    sendEmail: vi.fn(async (_to: string, subject: string) => { alerts.push(subject); }),
    deliverEmail: vi.fn(async (to: string, subject: string, html: string, opts: { idempotencyKey?: string } = {}) => {
      const next = provider.shift() ?? "ok";
      if (next === "timeout") throw new Error("The operation was aborted due to timeout");
      if (next === "permanent") throw new PermanentEmailError("Brevo rejected the email: invalid_parameter: email is not valid");
      if (next === "duplicate") return { status: "duplicate" };
      sent.push({ to, subject, html, idempotencyKey: opts.idempotencyKey });
      return { status: "sent", messageId: `<msg-${sent.length}@smtp-relay.mailin.fr>` };
    }),
  };
});
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
  beforeEach(async () => {
    await resetDb(); stripe = fakeStripe(); sent.length = 0; alerts.length = 0; provider = [];
    process.env.ADMIN_EMAIL = "admin@ops.example.com";
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete process.env.ADMIN_EMAIL; });
  const passRow = async () => (await db.select().from(aiTutorPasses))[0];
  const due = () => db.update(aiTutorPasses).set({ confirmationEmailNextAttemptAt: new Date(0) });

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
    // A copy of the accepted terms the customer can keep
    expect(body).toContain(`Your AI Tutor Pass Terms (version ${AI_PASS_TERMS.version})`);
    expect(body).toContain("Please keep this email");
    expect(body).toContain("6. Your right to cancel");
    expect(body).toContain("1A. Who can buy");
    expect(mail.html).toContain(`${AI_PASS_TERMS.path}`);
    expect(body).toContain(`version ${AI_PASS_TERMS.version}`);
    expect(mail.html).toContain(`mailto:${AI_PASS_TERMS.supportEmail}`);
    expect(body).not.toMatch(/(?<!not )unlimited/i);              // only ever "not unlimited"
    expect(body).toContain("Tax No VAT is charged — Edquis Ltd is not registered for VAT.");
    expect(body).not.toMatch(/incl(uding|\.)? VAT|VAT number/i);     // never claims VAT is included
  });

  it("without the immediate-access request: states the 14-day right to cancel and its end date", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    const body = text(sent[0].html);
    expect(body).toMatch(/You didn't ask for immediate access, so you can cancel until .+ \(14 days after your purchase\) for a full refund/);
    expect(body).not.toContain(IMMEDIATE_ACCESS_ACK_TEXT);
  });

  it("with the immediate-access request: quotes the acknowledgement and when it was given", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, true);
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    const html = sent[0].html;
    expect(html).toContain(escapedAck);
    expect(text(html)).toMatch(/you asked for it to start immediately/);
    expect(text(html)).toContain("we'll refund the price less a proportionate amount for the days of access you've had");
    expect(text(html)).not.toContain("for a full refund. To cancel");
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
    expect(pass).toMatchObject({ confirmationEmailStatus: "sent", confirmationEmailAttempts: 1 });
  });

  it("records delivery on the pass, with the pass id as the provider idempotency key", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    const result = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    const row = await passRow();
    expect(sent[0].idempotencyKey).toBe(result.outcome === "granted" && result.pass.id);
    expect(row).toMatchObject({ confirmationEmailStatus: "sent", confirmationEmailAttempts: 1, confirmationEmailLastError: null });
    expect(row.confirmationEmailMessageId).toMatch(/^<msg-1@/);
    expect(row.confirmationEmailSentAt).not.toBeNull();
  });

  it("provider timeout: the pass stays granted, the email is retried later and sent once", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    provider = ["timeout"];
    const result = await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(result.outcome).toBe("granted");
    expect(await AiTutorPassService.currentPass(s.id)).not.toBeNull();   // a failed email never loses the pass
    let row = await passRow();
    expect(row).toMatchObject({ confirmationEmailStatus: "pending", confirmationEmailAttempts: 1 });
    expect(row.confirmationEmailLastError).toContain("timeout");
    expect(row.confirmationEmailNextAttemptAt!.getTime()).toBeGreaterThan(Date.now());

    expect((await AiTutorPassService.processPendingConfirmationEmails()).due).toBe(0);   // not due yet
    await due();
    expect(await AiTutorPassService.processPendingConfirmationEmails()).toMatchObject({ due: 1, sent: 1 });
    row = await passRow();
    expect(row).toMatchObject({ confirmationEmailStatus: "sent", confirmationEmailAttempts: 2 });
    expect(sent).toHaveLength(1);
  });

  it("crash after claiming (stale 'sending') is reclaimed and retried with the same idempotency key", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    provider = ["timeout"];
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    // Simulate a worker that claimed the job and died before recording the outcome
    await db.update(aiTutorPasses).set({ confirmationEmailStatus: "sending", confirmationEmailClaimedAt: new Date(Date.now() - 5 * 60_000) });
    expect((await AiTutorPassService.processPendingConfirmationEmails()).due).toBe(0);   // a live claim isn't stolen
    await db.update(aiTutorPasses).set({ confirmationEmailClaimedAt: new Date(Date.now() - 11 * 60_000) });
    expect(await AiTutorPassService.processPendingConfirmationEmails()).toMatchObject({ due: 1, sent: 1 });
    expect(sent[0].idempotencyKey).toBe((await passRow()).id);
  });

  it("provider already accepted this key (duplicate_parameter): marked sent, not delivered again", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    provider = ["duplicate"];
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(await passRow()).toMatchObject({ confirmationEmailStatus: "sent", confirmationEmailMessageId: "duplicate-accepted" });
    expect(sent).toHaveLength(0);
  });

  it("permanent failure: marked failed, admin alerted and listed — the pass is unaffected", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    provider = ["permanent"];
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(await passRow()).toMatchObject({ confirmationEmailStatus: "failed" });
    expect(alerts).toContain("AI Tutor Pass: Purchase confirmation email could not be delivered");
    expect(await AiTutorPassService.currentPass(s.id)).not.toBeNull();
    const issues = await AiTutorPassService.adminIssues();
    expect(issues.confirmationEmails.map((e) => e.status)).toEqual(["failed"]);
    await due();
    expect((await AiTutorPassService.processPendingConfirmationEmails()).due).toBe(0);   // never retried automatically
  });

  it("repeated transient failures stop after the attempt limit and alert administrators", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    provider = Array(8).fill("timeout");
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    for (let i = 0; i < 7; i++) { await due(); await AiTutorPassService.processPendingConfirmationEmails(); }
    expect(await passRow()).toMatchObject({ confirmationEmailStatus: "failed", confirmationEmailAttempts: 8 });
    expect(alerts.filter((a) => a.includes("confirmation email"))).toHaveLength(1);
    expect(sent).toHaveLength(0);
  });

  it("missing recipient address: failed permanently and alerted", async () => {
    const s = await makeUser();
    const { users } = await import("@/db/schema");
    await db.update(users).set({ email: "" }).where(eq(users.id, s.id));
    const session = await purchase(stripe, s.id, false);
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    expect(await passRow()).toMatchObject({ confirmationEmailStatus: "failed", confirmationEmailLastError: "Student has no email address" });
    expect(alerts.length).toBe(1);
  });

  it("refund before the email is delivered: the pending email is skipped and never sent", async () => {
    mockStudyMind(() => json(200, {}));
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    provider = ["timeout"];
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    await AiTutorPassService.handleRefund(stripe.refundAt(session.payment_intent as string));
    expect(await passRow()).toMatchObject({ confirmationEmailStatus: "skipped", confirmationEmailLastError: "pass refunded" });
    await due();
    expect((await AiTutorPassService.processPendingConfirmationEmails()).due).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("concurrent workers (cron + webhook) deliver once", async () => {
    const s = await makeUser();
    const session = await purchase(stripe, s.id, false);
    provider = ["timeout"];
    await AiTutorPassService.fulfilCheckoutSession(session.id, "webhook");
    await due();
    await Promise.all([1, 2, 3].map(() => AiTutorPassService.processPendingConfirmationEmails()));
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
    expect((await AiTutorPassService.processPendingConfirmationEmails({ passId: p.id })).due).toBe(0);
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
