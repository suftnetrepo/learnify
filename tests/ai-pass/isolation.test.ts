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
      await createAiPassCheckoutSession({ priceId: "price_x", studentId: "s", studentEmail: "s@test.local", returnCourseId: "c", consentAt: new Date().toISOString(), termsVersion: "v1", immediateAccess: false });
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

describe("AI Tutor Pass terms content", () => {
  it("covers every required topic, is versioned and marked as a draft", async () => {
    const { AI_PASS_TERMS, AI_PASS_TERMS_SECTIONS } = await import("@/lib/ai-pass/terms");
    expect(AI_PASS_TERMS.version).toMatch(/draft/);
    expect(AI_PASS_TERMS.approved).toBe(false);
    const ids = AI_PASS_TERMS_SECTIONS.map((s) => s.id);
    for (const id of ["what-it-is", "price", "access", "allowances", "fair-use", "cancellation", "refunds", "faulty", "disputes", "courses", "changes", "contact"]) {
      expect(ids).toContain(id);
    }
  });

  it("states the price, duration, no renewal, shared daily allowances and a per-pass fair-use limit", async () => {
    const { AI_PASS_TERMS_SECTIONS } = await import("@/lib/ai-pass/terms");
    const all = AI_PASS_TERMS_SECTIONS.flatMap((s) => s.paragraphs).join(" ");
    expect(all).toContain("one-time digital purchase of £9.99");
    expect(all).toContain("30 consecutive days");
    expect(all).toContain("not a subscription and it does not renew automatically");
    expect(all).toContain("up to 60 AI tutor questions and create up to 5 quizzes, 5 flashcard sets and 3 summaries");
    expect(all).toContain("shared across all the free courses you're enrolled in");
    expect(all).toContain("reset at midnight UK time");
    expect(all).toContain("is not unlimited");
    expect(all).toContain("total fair-use limit on AI usage for its whole 30 days");
    expect(all).toContain("even if days remain");
    expect(all).toContain("It does not reset at midnight");
    expect(all).not.toMatch(/per day.*fair-use|daily fair-use/i);
  });

  it("cancellation and refunds: statutory rights preserved, legal questions flagged, no VAT claim", async () => {
    const { AI_PASS_TERMS, AI_PASS_TERMS_SECTIONS } = await import("@/lib/ai-pass/terms");
    const section = (id: string) => AI_PASS_TERMS_SECTIONS.find((s) => s.id === id)!.paragraphs.join(" ");
    expect(section("cancellation")).toContain("If you do NOT ask for immediate access: your pass still starts straight away, and you can cancel within 14 days");
    expect(section("cancellation")).toContain("[LEGAL REVIEW");
    expect(section("cancellation")).toContain("A queued pass that hasn't started yet can be cancelled for a full refund");
    expect(section("refunds")).toContain("its access ends immediately");
    expect(section("faulty")).toContain("Your statutory rights are not affected");
    expect(section("disputes")).toContain("not restored automatically");
    expect(section("courses")).toContain("30-day money-back guarantee, which applies to courses and not to AI Tutor Passes");
    expect(AI_PASS_TERMS.taxNote).toBeNull();
    expect(AI_PASS_TERMS_SECTIONS.flatMap((s) => s.paragraphs).join(" ")).not.toMatch(/\bVAT\b/);
    expect(AI_PASS_TERMS.immediateAccessAckRequired).toBe(false);
  });
});
