import { afterEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { isAiTutorPassEnabled } from "@/lib/flags";
import { AiTutorPassService } from "@/services/ai-tutor-pass.service";

const event = (type: string, object: unknown) => ({ id: "evt_x", type, data: { object } }) as unknown as Stripe.Event;

// No database needed: non-pass events must be passed straight through to the existing handlers
describe("feature flag and webhook isolation", () => {
  afterEach(() => { delete process.env.ENABLE_AI_TUTOR_PASS; });

  it("flag is off unless exactly 'true'", () => {
    expect(isAiTutorPassEnabled()).toBe(false);
    for (const v of ["1", "yes", "TRUE", " true", ""]) {
      process.env.ENABLE_AI_TUTOR_PASS = v;
      expect(isAiTutorPassEnabled()).toBe(false);
    }
    process.env.ENABLE_AI_TUTOR_PASS = "true";
    expect(isAiTutorPassEnabled()).toBe(true);
  });

  it.each([
    "checkout.session.completed", "checkout.session.async_payment_succeeded",
    "checkout.session.expired", "checkout.session.async_payment_failed",
  ])("course %s falls through to the existing handler", async (type) => {
    const handled = await AiTutorPassService.handleStripeEvent(event(type, { id: "cs_c", metadata: { courseId: "c", studentId: "s" } }));
    expect(handled).toBe(false);
  });

  it("course payment_intent.payment_failed falls through", async () => {
    expect(await AiTutorPassService.handleStripeEvent(event("payment_intent.payment_failed", { id: "pi", metadata: {} }))).toBe(false);
  });

  it("other events (payout.failed, account.updated) fall through", async () => {
    expect(await AiTutorPassService.handleStripeEvent(event("payout.failed", {}))).toBe(false);
    expect(await AiTutorPassService.handleStripeEvent(event("account.updated", {}))).toBe(false);
  });

  it("pass payment failure is acknowledged without granting", async () => {
    // (pass checkout expiry frees its reservation in the database — covered in purchase-routes)
    const meta = { metadata: { app: "learnify", kind: "ai_tutor_pass" } };
    expect(await AiTutorPassService.handleStripeEvent(event("payment_intent.payment_failed", meta))).toBe(true);
  });
});

describe("shipped defaults", () => {
  it(".env.example ships the AI Tutor Pass disabled", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(".env.example", "utf8")).toMatch(/^ENABLE_AI_TUTOR_PASS="false"$/m);
  });
});
