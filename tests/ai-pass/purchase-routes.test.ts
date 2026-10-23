import type Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { POST as checkout } from "@/app/api/ai-pass/checkout/route";
import { POST as confirm } from "@/app/api/ai-pass/confirm/route";
import { GET as status } from "@/app/api/ai-pass/status/route";
import { GET as cron } from "@/app/api/cron/ai-pass-revocations/route";
import { db } from "@/db";
import { aiTutorPasses } from "@/db/schema";
import { DAY_MS } from "@/lib/ai-pass/config";
import { enrol, hasDb, json, jsonRequest, makeCourse, makePass, makeUser, mockLineItems, mockStudyMind, passSession, resetDb } from "../helpers";

const signIn = (u: { id: string; role: string }) => vi.mocked(auth).mockResolvedValue({ user: { id: u.id, role: u.role, email: "s@test.local" } } as never);
const buy = (body: unknown) => checkout(jsonRequest("https://learnify.test/api/ai-pass/checkout", body));

describe.skipIf(!hasDb)("AI Tutor Pass purchase routes", () => {
  let create: MockInstance<typeof stripe.checkout.sessions.create>;
  beforeEach(async () => {
    await resetDb();
    process.env.ENABLE_AI_TUTOR_PASS = "true";
    create = vi.spyOn(stripe.checkout.sessions, "create").mockResolvedValue({ id: "cs_test_new", url: "https://checkout.stripe.test/x" } as never);
    (globalThis as { __rateLimitStore?: Map<string, unknown> }).__rateLimitStore?.clear();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); delete process.env.ENABLE_AI_TUTOR_PASS; process.env.STRIPE_AI_PASS_PRICE_ID = "price_ai_pass_test"; });

  describe("POST /api/ai-pass/checkout", () => {
    it("404 when the flag is off", async () => {
      delete process.env.ENABLE_AI_TUTOR_PASS;
      expect((await buy({})).status).toBe(404);
      expect(create).not.toHaveBeenCalled();
    });

    it("creates a one-time Checkout with the dedicated price, no promo codes, managed payments off", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      const res = await buy({ courseId: c.id, consent: true });
      expect(res.status).toBe(200);
      expect((await res.json()).data.url).toBe("https://checkout.stripe.test/x");
      const params = create.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
      expect(params).toMatchObject({
        mode: "payment", line_items: [{ price: "price_ai_pass_test", quantity: 1 }],
        allow_promotion_codes: false, managed_payments: { enabled: false }, client_reference_id: s.id,
        metadata: { app: "learnify", kind: "ai_tutor_pass", student_id: s.id, return_course_id: c.id },
        payment_intent_data: { metadata: { app: "learnify", kind: "ai_tutor_pass", student_id: s.id } },
      });
      expect(params.metadata?.consent_at).toBeTruthy();
      expect(params).not.toHaveProperty("discounts");
      expect(params.payment_intent_data).not.toHaveProperty("application_fee_amount");
      expect(params.payment_intent_data).not.toHaveProperty("transfer_data");
    });

    it("requires explicit consent", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      expect((await buy({ courseId: c.id })).status).toBe(400);
      expect((await buy({ courseId: c.id, consent: "yes" })).status).toBe(400);
      expect(create).not.toHaveBeenCalled();
    });

    it("requires enrolment in a free course", async () => {
      const s = await makeUser(); signIn(s);
      const free = await makeCourse("0"), paid = await makeCourse("10.00"), grand = await makeCourse("0");
      await enrol(s.id, paid.id, { amount: "10.00" });
      await enrol(s.id, grand.id, { amount: "10.00" });
      for (const c of [free, paid, grand]) expect((await buy({ courseId: c.id, consent: true })).status).toBe(403);
      expect(create).not.toHaveBeenCalled();
    });

    it("rejects non-students and signed-out users", async () => {
      const c = await makeCourse("0");
      vi.mocked(auth).mockResolvedValue(null as never);
      expect((await buy({ courseId: c.id, consent: true })).status).toBe(401);
      signIn(await makeUser("tutor"));
      expect((await buy({ courseId: c.id, consent: true })).status).toBe(403);
    });

    it("allows at most two queued passes", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      await makePass(s.id, { endOffsetMs: 10 * DAY_MS });
      await makePass(s.id, { startOffsetMs: 10 * DAY_MS, endOffsetMs: 40 * DAY_MS });
      expect((await buy({ courseId: c.id, consent: true })).status).toBe(200);
      await makePass(s.id, { startOffsetMs: 40 * DAY_MS, endOffsetMs: 70 * DAY_MS });
      expect((await buy({ courseId: c.id, consent: true })).status).toBe(409);
    });

    it("503 without a configured price (never falls back to a dynamic amount)", async () => {
      delete process.env.STRIPE_AI_PASS_PRICE_ID;
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      expect((await buy({ courseId: c.id, consent: true })).status).toBe(503);
      expect(create).not.toHaveBeenCalled();
    });

    it("is rate limited", async () => {
      const s = await makeUser(); const c = await makeCourse("0"); await enrol(s.id, c.id); signIn(s);
      const codes = [];
      for (let i = 0; i < 6; i++) codes.push((await buy({ courseId: c.id, consent: true })).status);
      expect(codes.at(-1)).toBe(429);
    });
  });

  describe("POST /api/ai-pass/confirm", () => {
    const post = (sessionId: string) => confirm(jsonRequest("https://learnify.test/api/ai-pass/confirm", { sessionId }));

    it("fulfils the caller's own paid session (idempotent with the webhook)", async () => {
      mockLineItems();
      const s = await makeUser(); signIn(s);
      const session = passSession(s.id);
      vi.spyOn(stripe.checkout.sessions, "retrieve").mockResolvedValue(session as never);
      const res = await post(session.id);
      expect(res.status).toBe(200);
      expect((await res.json()).data.current).not.toBeNull();
      await post(session.id);
      expect(await db.select().from(aiTutorPasses)).toHaveLength(1);
    });

    it("refuses someone else's session", async () => {
      mockLineItems();
      const owner = await makeUser(), other = await makeUser(); signIn(other);
      const session = passSession(owner.id);
      vi.spyOn(stripe.checkout.sessions, "retrieve").mockResolvedValue(session as never);
      expect((await post(session.id)).status).toBe(403);
      expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
    });

    it("unpaid session: 409, nothing granted", async () => {
      mockLineItems();
      const s = await makeUser(); signIn(s);
      const session = passSession(s.id, { payment_status: "unpaid" });
      vi.spyOn(stripe.checkout.sessions, "retrieve").mockResolvedValue(session as never);
      expect((await post(session.id)).status).toBe(409);
      expect(await db.select().from(aiTutorPasses)).toHaveLength(0);
    });

    it("tampered amount: 422, nothing granted", async () => {
      mockLineItems();
      const s = await makeUser(); signIn(s);
      const session = passSession(s.id, { amount_total: 100 });
      vi.spyOn(stripe.checkout.sessions, "retrieve").mockResolvedValue(session as never);
      expect((await post(session.id)).status).toBe(422);
    });

    it("404 when the flag is off", async () => {
      delete process.env.ENABLE_AI_TUTOR_PASS;
      expect((await post("cs_test_aaaaaaaaaa")).status).toBe(404);
    });
  });

  describe("GET /api/ai-pass/status", () => {
    it("flag off: disabled, no pass data", async () => {
      delete process.env.ENABLE_AI_TUTOR_PASS;
      const s = await makeUser(); await makePass(s.id); signIn(s);
      const body = (await (await status()).json()).data;
      expect(body.enabled).toBe(false);
      expect(body).not.toHaveProperty("current");
    });

    it("current, queued and live usage", async () => {
      mockStudyMind(() => json(200, { pass_id: "x", status: "active", features: {}, budget_exhausted: false }));
      const s = await makeUser(); signIn(s);
      const cur = await makePass(s.id, { endOffsetMs: 10 * DAY_MS, policy: true });
      await makePass(s.id, { startOffsetMs: 10 * DAY_MS, endOffsetMs: 40 * DAY_MS });
      const body = (await (await status()).json()).data;
      expect(body.current.passId).toBe(cur.id);
      expect(body.queued).toHaveLength(1);
      expect(body.canPurchaseMore).toBe(true);
      expect(body.usage.status).toBe("active");
    });

    it("StudyMind down: status still works, usage marked unavailable", async () => {
      mockStudyMind(() => { throw new TypeError("fetch failed"); });
      const s = await makeUser(); signIn(s); await makePass(s.id, { policy: true });
      const body = (await (await status()).json()).data;
      expect(body.current).not.toBeNull();
      expect(body.usageAvailable).toBe(false);
    });

    it("shows a refunded pass as the last state", async () => {
      const s = await makeUser(); signIn(s); await makePass(s.id, { revoked: true });
      const body = (await (await status()).json()).data;
      expect(body.current).toBeNull();
      expect(body.last.state).toBe("refunded");
    });
  });

  describe("GET /api/cron/ai-pass-revocations", () => {
    const req = (auth?: string) => new Request("https://learnify.test/api/cron/ai-pass-revocations", { headers: auth ? { authorization: auth } : {} }) as never;
    it("requires the cron secret", async () => {
      expect((await cron(req())).status).toBe(401);
      expect((await cron(req("Bearer wrong"))).status).toBe(401);
    });
    it("retries due revocations", async () => {
      mockStudyMind(() => json(200, {}));
      const s = await makeUser(); const p = await makePass(s.id, { revoked: true });
      const { eq } = await import("drizzle-orm");
      await db.update(aiTutorPasses).set({ studymindRevokeStatus: "pending", studymindRevokeNextAttemptAt: new Date(0) }).where(eq(aiTutorPasses.id, p.id));
      const res = await cron(req("Bearer cron_test_secret"));
      expect((await res.json()).data).toEqual({ due: 1, done: 1, failed: 0 });
    });
  });
});
