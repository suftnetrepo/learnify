import { vi } from "vitest";
import type Stripe from "stripe";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { aiTutorPasses, courses, enrollments, purchases, users } from "@/db/schema";
import { stripe } from "@/lib/stripe";
import { DAY_MS } from "@/lib/ai-pass/config";

export const hasDb = !!process.env.TEST_DATABASE_URL;
export const PRICE_ID = "price_ai_pass_test";

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function resetDb() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local client_min_messages to warning`);
    await tx.execute(sql`truncate ai_tutor_passes, enrollments, purchases, courses, users restart identity cascade`);
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
