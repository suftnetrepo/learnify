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

describe("Checkout payment methods", () => {
  it("AI Tutor Pass Checkout is card-only", async () => {
    const { vi } = await import("vitest");
    const { stripe } = await import("@/lib/stripe");
    const { createAiPassCheckoutSession } = await import("@/lib/stripe");
    const create = vi.spyOn(stripe.checkout.sessions, "create").mockResolvedValue({ id: "cs_test_x" } as never);
    try {
      await createAiPassCheckoutSession({ priceId: "price_x", studentId: "s", studentEmail: "s@test.local", returnCourseId: "c", consentAt: new Date().toISOString() });
      expect(create.mock.calls[0][0]).toMatchObject({ payment_method_types: ["card"], managed_payments: { enabled: false }, allow_promotion_codes: false });
    } finally { create.mockRestore(); }
  });

  it("course Checkout is unchanged: no payment-method restriction, promo codes and Connect as before", async () => {
    const { vi } = await import("vitest");
    const { stripe, createCheckoutSession } = await import("@/lib/stripe");
    const create = vi.spyOn(stripe.checkout.sessions, "create").mockResolvedValue({ id: "cs_test_y" } as never);
    try {
      await createCheckoutSession({
        courseId: "c1", courseTitle: "Course", courseSlug: "course", priceInPounds: 25,
        studentId: "s1", studentEmail: "s@test.local", tutorStripeId: "acct_tutor", thumbnailUrl: null,
      });
      const params = create.mock.calls[0][0] as Record<string, unknown>;
      expect(params).not.toHaveProperty("payment_method_types");
      expect(params).toMatchObject({
        mode: "payment", managed_payments: { enabled: false }, allow_promotion_codes: true, billing_address_collection: "required",
        metadata: { courseId: "c1", courseSlug: "course", studentId: "s1" },
        payment_intent_data: { transfer_data: { destination: "acct_tutor" } },
      });
      expect((params.line_items as { price_data: { unit_amount: number } }[])[0].price_data.unit_amount).toBe(2500);
    } finally { create.mockRestore(); }
  });
});

describe("email safety", () => {
  it("never delivers to reserved test domains (UAT fixtures)", async () => {
    const { isReservedTestAddress } = await import("@/lib/email");
    for (const a of ["uat-studenta@learnify.local", "x@foo.test", "x@example", "x@a.example", "x@b.invalid", "x@localhost"]) {
      expect(isReservedTestAddress(a)).toBe(true);
    }
    for (const a of ["admin@yahoo.com", "x@edquis.com", "x@learnify.dev", "x@localtest.me", "x@my.testing.io"]) {
      expect(isReservedTestAddress(a)).toBe(false);
    }
  });
});
