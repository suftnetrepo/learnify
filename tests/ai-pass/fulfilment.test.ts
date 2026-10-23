import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiTutorPasses } from "@/db/schema";
import { AiTutorPassService, PassFulfilmentError } from "@/services/ai-tutor-pass.service";
import { DAY_MS } from "@/lib/ai-pass/config";
import { hasDb, makePass, makeUser, mockLineItems, passSession, resetDb } from "../helpers";

describe.skipIf(!hasDb)("AI Tutor Pass fulfilment", () => {
  beforeEach(async () => { await resetDb(); mockLineItems(); });
  afterEach(() => { vi.restoreAllMocks(); process.env.STRIPE_AI_PASS_PRICE_ID = "price_ai_pass_test"; });

  it("grants a 30-day pass from a valid paid session", async () => {
    const s = await makeUser();
    const session = passSession(s.id);
    const before = Date.now();
    const { pass, created } = await AiTutorPassService.fulfilCheckoutSession(session, "webhook", "evt_1");
    expect(created).toBe(true);
    expect(pass.studentId).toBe(s.id);
    expect(pass.amountPence).toBe(999);
    expect(pass.stripePriceId).toBe("price_ai_pass_test");
    expect(pass.consentAt).not.toBeNull();
    expect(pass.startsAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(pass.endsAt.getTime() - pass.startsAt.getTime()).toBe(30 * DAY_MS);
  });

  it("is idempotent for the same session (webhook retry + confirm)", async () => {
    const s = await makeUser(); const session = passSession(s.id);
    const a = await AiTutorPassService.fulfilCheckoutSession(session, "webhook");
    const b = await AiTutorPassService.fulfilCheckoutSession(session, "confirm");
    expect(b.created).toBe(false);
    expect(b.pass.id).toBe(a.pass.id);
  });

  it("concurrent delivery of the same session creates exactly one pass", async () => {
    const s = await makeUser(); const session = passSession(s.id);
    const results = await Promise.all([
      AiTutorPassService.fulfilCheckoutSession(session, "webhook"),
      AiTutorPassService.fulfilCheckoutSession(session, "confirm"),
      AiTutorPassService.fulfilCheckoutSession(session, "webhook"),
    ]);
    expect(new Set(results.map((r) => r.pass.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await db.select().from(aiTutorPasses).where(eq(aiTutorPasses.studentId, s.id))).toHaveLength(1);
  });

  it("concurrent different purchases get separate, back-to-back periods", async () => {
    const s = await makeUser();
    await Promise.all([1, 2, 3].map(() => AiTutorPassService.fulfilCheckoutSession(passSession(s.id), "webhook")));
    const rows = await db.select().from(aiTutorPasses).where(eq(aiTutorPasses.studentId, s.id)).orderBy(aiTutorPasses.startsAt);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
    expect(rows[1].startsAt.getTime()).toBe(rows[0].endsAt.getTime());
    expect(rows[2].startsAt.getTime()).toBe(rows[1].endsAt.getTime());
  });

  it("renewal queues after the current pass; current pass is not modified", async () => {
    const s = await makeUser();
    const current = await makePass(s.id, { endOffsetMs: 5 * DAY_MS, policy: true });
    const { pass } = await AiTutorPassService.fulfilCheckoutSession(passSession(s.id), "webhook");
    expect(pass.id).not.toBe(current.id);
    expect(pass.startsAt.getTime()).toBe(current.endsAt.getTime());
    const [after] = await db.select().from(aiTutorPasses).where(eq(aiTutorPasses.id, current.id));
    expect(after.endsAt.getTime()).toBe(current.endsAt.getTime());
    expect((await AiTutorPassService.currentPass(s.id))?.id).toBe(current.id);
  });

  it("a revoked pass does not delay a new purchase", async () => {
    const s = await makeUser();
    await makePass(s.id, { revoked: true });
    const before = Date.now();
    const { pass } = await AiTutorPassService.fulfilCheckoutSession(passSession(s.id), "webhook");
    expect(pass.startsAt.getTime()).toBeLessThan(before + 5000);
  });

  describe("rejects sessions that must not grant a pass", () => {
    const cases: [string, (id: string) => Parameters<typeof passSession>[1]][] = [
      ["unpaid",                () => ({ payment_status: "unpaid" })],
      ["wrong amount",          () => ({ amount_total: 1 })],
      ["zero amount",           () => ({ amount_total: 0 })],
      ["wrong currency",        () => ({ currency: "usd" })],
      ["subscription mode",     () => ({ mode: "subscription" })],
      ["owner mismatch",        () => ({ client_reference_id: "00000000-0000-0000-0000-000000000000" })],
      ["not a pass session",    (id) => ({ metadata: { courseId: "x", studentId: id } })],
      ["missing student id",    () => ({ metadata: { app: "learnify", kind: "ai_tutor_pass" } })],
    ];
    for (const [name, over] of cases) {
      it(name, async () => {
        const s = await makeUser();
        await expect(AiTutorPassService.fulfilCheckoutSession(passSession(s.id, over(s.id)), "webhook"))
          .rejects.toBeInstanceOf(PassFulfilmentError);
        expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
      });
    }

    const items: [string, Parameters<typeof mockLineItems>[0]][] = [
      ["different price id", { price: "price_other" }],
      ["quantity 2",         { quantity: 2 }],
      ["two line items",     { count: 2 }],
      ["line amount differs", { amount: 500 }],
    ];
    for (const [name, item] of items) {
      it(name, async () => {
        vi.restoreAllMocks(); mockLineItems(item);
        const s = await makeUser();
        await expect(AiTutorPassService.fulfilCheckoutSession(passSession(s.id), "webhook")).rejects.toBeInstanceOf(PassFulfilmentError);
      });
    }

    it("purchaser is not a student", async () => {
      const t = await makeUser("tutor");
      await expect(AiTutorPassService.fulfilCheckoutSession(passSession(t.id), "webhook")).rejects.toBeInstanceOf(PassFulfilmentError);
    });

    it("price not configured", async () => {
      delete process.env.STRIPE_AI_PASS_PRICE_ID;
      const s = await makeUser();
      await expect(AiTutorPassService.fulfilCheckoutSession(passSession(s.id), "webhook")).rejects.toBeInstanceOf(PassFulfilmentError);
    });
  });
});
