import { vi } from "vitest";
import type Stripe from "stripe";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { courses, enrollments, purchases, users } from "@/db/schema";
import { aiTutorPasses } from "@/db/schema";
import { stripe } from "@/lib/stripe";
import { DAY_MS } from "@/lib/ai-pass/config";

export const hasDb = !!process.env.TEST_DATABASE_URL;
export const PRICE_ID = "price_ai_pass_test";

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function resetDb() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local client_min_messages to warning`);
    await tx.execute(sql`truncate ai_pass_checkouts, ai_tutor_passes, enrollments, purchases, courses, users restart identity cascade`);
  });
}

export async function makeUser(role: "student" | "tutor" | "admin" = "student") {
  const [u] = await db.insert(users).values({ email: `${role}-${uniq()}@test.local`, role }).returning();
  return u;
}

export async function makeCourse(price: string) {
  const [c] = await db.insert(courses).values({ title: "Course", slug: `course-${uniq()}`, price, format: "online", status: "published" }).returning();
  return c;
}

export async function enrol(studentId: string, courseId: string, purchase?: { amount: string; status?: "completed" | "pending" | "refunded" }) {
  let purchaseId: string | null = null;
  if (purchase) {
    const [p] = await db.insert(purchases).values({
      studentId, courseId, amount: purchase.amount, platformFee: "0", tutorAmount: "0",
      status: purchase.status ?? "completed", stripeSessionId: `cs_course_${uniq()}`,
    }).returning();
    purchaseId = p.id;
  }
  await db.insert(enrollments).values({ studentId, courseId, purchaseId });
}

/** Insert a pass directly (bypassing Stripe), positioned relative to now. */
export async function makePass(studentId: string, opts: { startOffsetMs?: number; endOffsetMs?: number; revoked?: boolean; policy?: boolean; pi?: string } = {}) {
  const now = Date.now();
  const startsAt = new Date(now + (opts.startOffsetMs ?? -DAY_MS));
  const endsAt   = new Date(now + (opts.endOffsetMs ?? 29 * DAY_MS));
  const [p] = await db.insert(aiTutorPasses).values({
    studentId,
    stripeCheckoutSessionId: `cs_test_${uniq()}`,
    stripePaymentIntentId:   opts.pi ?? `pi_test_${uniq()}`,
    stripePriceId: PRICE_ID, fulfilledVia: "webhook", amountPence: 999, currency: "gbp",
    purchasedAt: new Date(now), startsAt, endsAt,
    revokedAt: opts.revoked ? new Date(now) : null,
    revokeReason: opts.revoked ? "refunded" : null,
    studymindPolicyCreatedAt: opts.policy ? new Date(now) : null,
  }).returning();
  return p;
}

/** A paid AI Tutor Pass Checkout Session as Stripe would send it (override any field). */
export function passSession(studentId: string, over: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: `cs_test_${uniq()}`, object: "checkout.session", mode: "payment", payment_status: "paid",
    status: "complete", currency: "gbp", amount_total: 999, client_reference_id: studentId,
    payment_intent: `pi_test_${uniq()}`,
    metadata: { app: "learnify", kind: "ai_tutor_pass", student_id: studentId, consent_at: new Date().toISOString() },
    ...over,
  } as Stripe.Checkout.Session;
}

/** Stripe's line items for a session: the pass price, or whatever the test overrides. */
export function mockLineItems(item: Partial<{ price: string; quantity: number; amount: number; currency: string; count: number }> = {}) {
  const line = {
    quantity: item.quantity ?? 1, amount_total: item.amount ?? 999, currency: item.currency ?? "gbp",
    price: { id: item.price ?? PRICE_ID },
  };
  return vi.spyOn(stripe.checkout.sessions, "listLineItems")
    .mockResolvedValue({ data: Array.from({ length: item.count ?? 1 }, () => line) } as never);
}

/** Records StudyMind calls; `respond` decides each response. */
export function mockStudyMind(respond: (url: string, body: Record<string, unknown> | null) => Response | Promise<Response>) {
  const calls: { url: string; body: Record<string, unknown> | null }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url  = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    return respond(url, body);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  // NextRequest is a Request subclass; the handlers only use .json()/.text()/.headers
  return new Request(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }) as never;
}

/**
 * In-memory Stripe for the AI Tutor Pass flows: Checkout Sessions, PaymentIntents (with their
 * latest charge), line items, refunds, expiry and listing. Fulfilment re-reads everything from
 * here, so tests change Stripe's state (refund, dispute) exactly as the real API would show it.
 */
export function fakeStripe(opts: { lineItem?: Parameters<typeof mockLineItems>[0] } = {}) {
  const sessions = new Map<string, Stripe.Checkout.Session>();
  const intents  = new Map<string, Stripe.PaymentIntent & { latest_charge: Stripe.Charge }>();
  const refunds: { payment_intent: string; idempotencyKey?: string }[] = [];
  let refundError: (Error & { code?: string }) | null = null;
  const missing = (what: string) => Object.assign(new Error(`No such ${what}`), { code: "resource_missing" });

  const lineItems = mockLineItems(opts.lineItem);
  const spies = {
    lineItems,
    retrieve: vi.spyOn(stripe.checkout.sessions, "retrieve").mockImplementation((async (id: string) => {
      const sess = sessions.get(id); if (!sess) throw missing("checkout session"); return structuredClone(sess);
    }) as never),
    list: vi.spyOn(stripe.checkout.sessions, "list").mockImplementation((async (params?: { payment_intent?: string }) => ({
      data: [...sessions.values()].filter((x) => x.payment_intent === params?.payment_intent),
    })) as never),
    create: vi.spyOn(stripe.checkout.sessions, "create").mockImplementation((async (params: Stripe.Checkout.SessionCreateParams) => {
      const id = `cs_test_${uniq()}`;
      const sess = {
        id, object: "checkout.session", mode: "payment", status: "open", payment_status: "unpaid",
        currency: "gbp", amount_total: 999, client_reference_id: params.client_reference_id,
        metadata: params.metadata, expires_at: params.expires_at, payment_intent: null,
        url: `https://checkout.stripe.test/${id}`,
      } as unknown as Stripe.Checkout.Session;
      sessions.set(id, sess);
      return structuredClone(sess);
    }) as never),
    expire: vi.spyOn(stripe.checkout.sessions, "expire").mockImplementation((async (id: string) => {
      const sess = sessions.get(id); if (!sess) throw missing("checkout session");
      if (sess.status !== "open") throw Object.assign(new Error(`Session is ${sess.status}`), { code: "checkout_session_not_open" });
      sess.status = "expired";
      return structuredClone(sess);
    }) as never),
    piRetrieve: vi.spyOn(stripe.paymentIntents, "retrieve").mockImplementation((async (id: string) => {
      const pi = intents.get(id); if (!pi) throw missing("payment intent"); return structuredClone(pi);
    }) as never),
    refund: vi.spyOn(stripe.refunds, "create").mockImplementation((async (params: { payment_intent: string }, options?: { idempotencyKey?: string }) => {
      if (refundError) throw refundError;
      const pi = intents.get(params.payment_intent);
      if (!pi) throw missing("payment intent");
      if (pi.latest_charge.refunded) throw Object.assign(new Error("Charge already refunded"), { code: "charge_already_refunded" });
      refunds.push({ payment_intent: params.payment_intent, idempotencyKey: options?.idempotencyKey });
      pi.latest_charge.refunded = true; pi.latest_charge.amount_refunded = pi.amount;
      return { id: `re_test_${uniq()}`, status: "succeeded" };
    }) as never),
  };

  return {
    sessions, intents, refunds, spies,
    failRefunds(error: (Error & { code?: string }) | null) { refundError = error; },
    /** Simulate the student paying: a complete, paid pass session with a succeeded PaymentIntent. */
    pay(studentId: string, over: Partial<Stripe.Checkout.Session> = {}, piOver: Partial<Stripe.PaymentIntent> = {}) {
      const base = passSession(studentId, over);
      const existing = over.id ? sessions.get(over.id) : undefined;
      const sess = { ...(existing ?? {}), ...base, ...over, status: "complete", payment_status: over.payment_status ?? "paid" } as Stripe.Checkout.Session;
      sessions.set(sess.id, sess);
      const piId = sess.payment_intent as string;
      intents.set(piId, {
        id: piId, object: "payment_intent", status: "succeeded", amount: 999, currency: "gbp",
        metadata: { app: "learnify", kind: "ai_tutor_pass", student_id: studentId },
        latest_charge: { id: `ch_${uniq()}`, object: "charge", amount: 999, amount_refunded: 0, refunded: false, disputed: false, payment_intent: piId } as Stripe.Charge,
        ...piOver,
      } as Stripe.PaymentIntent & { latest_charge: Stripe.Charge });
      return sess;
    },
    /** Refund at Stripe; returns the charge as a charge.refunded event would carry it. */
    refundAt(piId: string, amount = 999) {
      const charge = intents.get(piId)!.latest_charge;
      charge.amount_refunded = amount; charge.refunded = amount >= charge.amount;
      return structuredClone(charge);
    },
    /** Dispute at Stripe; returns the dispute as charge.dispute.created would carry it. */
    disputeAt(piId: string, status = "needs_response") {
      intents.get(piId)!.latest_charge.disputed = true;
      return { id: `dp_${uniq()}`, object: "dispute", payment_intent: piId, status, amount: 999, reason: "fraudulent" } as unknown as Stripe.Dispute;
    },
  };
}
