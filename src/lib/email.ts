import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { emailQueue } from "@/db/schema";
import { BrevoEmailSender } from "@/lib/brevo-email-sender";
import { log } from "@/lib/logger";

class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email is not configured: BREVO_API_KEY and BREVO_FROM_EMAIL are required");
    this.name = "EmailNotConfiguredError";
  }
}

let cachedSender: BrevoEmailSender | null = null;

/**
 * Reserved, never-real domains (RFC 2606/6761) used by test and UAT accounts. Mail to them is never
 * handed to Brevo — so fixture accounts can't generate real email in any environment.
 */
const RESERVED_TLDS = [".local", ".test", ".example", ".invalid", ".localhost"];
export function isReservedTestAddress(to: string): boolean {
  const domain = to.trim().toLowerCase().split("@")[1] ?? "";
  return RESERVED_TLDS.some((tld) => domain === tld.slice(1) || domain.endsWith(tld));
}

function config() {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !fromEmail) throw new EmailNotConfiguredError();
  return { apiKey, fromEmail, fromName: process.env.BREVO_FROM_NAME ?? "Edquis" };
}

function plainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Development only: EMAIL_SINK_DIR writes emails to files instead of sending them (UAT). Ignored
 * in production.
 */
function sinkDir(): string | null {
  return process.env.NODE_ENV !== "production" && process.env.EMAIL_SINK_DIR ? process.env.EMAIL_SINK_DIR : null;
}

function writeToSink(dir: string, to: string, subject: string, html: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const id = `sink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(path.join(dir, `${id}.html`), `<!-- to: ${to} | subject: ${subject} -->\n${html}`);
  log.info("Email written to development sink", { to, subject, id });
  return id;
}

async function sendViaBrevo(
  to: string, subject: string, html: string, text?: string,
  extra: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<string | undefined> {
  const dir = sinkDir();
  if (dir) return writeToSink(dir, to, subject, html);
  const { apiKey, fromEmail, fromName } = config();
  cachedSender ??= new BrevoEmailSender(apiKey);
  const result = await cachedSender.sendEmail({
    sender: { email: fromEmail, name: fromName },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text ?? plainText(html),
    ...(extra.headers ? { headers: extra.headers } : {}),
  }, 0, { timeoutMs: extra.timeoutMs });
  if (!result.success) {
    throw Object.assign(new Error(`Brevo rejected the email: ${result.error}`), { status: result.status, providerError: result.error });
  }
  log.info("Email sent", { to, subject, messageId: result.messageId });
  return result.messageId;
}

export type DeliveryResult =
  | { status: "sent"; messageId?: string }
  | { status: "duplicate" }    // the provider already accepted this idempotency key
  | { status: "skipped"; reason: string };

/** A failure that retrying won't fix (invalid recipient, request rejected by the provider...). */
export class PermanentEmailError extends Error {
  constructor(message: string) { super(message); this.name = "PermanentEmailError"; }
}

/**
 * Send one email and report the outcome (unlike sendEmail, nothing is queued). The caller owns
 * retries. `idempotencyKey` (a UUID) is passed to Brevo, which rejects a repeat of the same key
 * within its TTL (30 minutes per Brevo's docs) with `duplicate_parameter` — reported here as
 * "duplicate", i.e. already delivered. Throws PermanentEmailError for failures retrying won't fix.
 */
export async function deliverEmail(
  to: string, subject: string, html: string,
  opts: { idempotencyKey?: string; timeoutMs?: number } = {},
): Promise<DeliveryResult> {
  if (isReservedTestAddress(to) && !sinkDir()) return { status: "skipped", reason: "reserved test address" };
  try {
    const messageId = await sendViaBrevo(to, subject, html, undefined, {
      headers: opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
      timeoutMs: opts.timeoutMs ?? 15_000,
    });
    return { status: "sent", messageId };
  } catch (error) {
    const providerError = (error as { providerError?: string }).providerError ?? "";
    const status = (error as { status?: number }).status;
    if (providerError.includes("duplicate_parameter")) return { status: "duplicate" };
    const message = error instanceof Error ? error.message : String(error);
    if (/recipient|sender email|subject is required|content is required/i.test(message)
        || (status !== undefined && status >= 400 && status < 500 && status !== 429)) {
      throw new PermanentEmailError(message);
    }
    throw error;   // transient (timeout, network, 429, 5xx) — the caller retries
  }
}

/** Send immediately, then durably queue any failure without breaking the business operation. */
export async function sendEmail(to: string, subject: string, html: string, context = subject): Promise<void> {
  if (isReservedTestAddress(to)) {
    log.info("Email skipped: reserved test address", { to, subject, context });
    return;
  }
  const text = plainText(html);
  try {
    await sendViaBrevo(to, subject, html, text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    log.error("Email send failed; queueing for retry", { to, subject, context, error: message });
    try {
      await db.insert(emailQueue).values({ to, subject, html, text, context, attempts: 1, lastError: message });
    } catch (queueError) {
      log.error("Email could not be queued", { to, subject, context, queueError });
    }
  }
}

export async function processEmailQueue(): Promise<{ sent: number; pending: number; failed: number }> {
  const items = await db.select().from(emailQueue).where(eq(emailQueue.status, "pending")).limit(50);
  let sent = 0;
  let pending = 0;
  let failed = 0;

  for (const item of items) {
    if (isReservedTestAddress(item.to)) {
      await db.update(emailQueue).set({
        status: "failed", lastError: "Not delivered: reserved test address", updatedAt: new Date(),
      }).where(eq(emailQueue.id, item.id));
      failed += 1;
      continue;
    }
    try {
      await sendViaBrevo(item.to, item.subject, item.html, item.text ?? undefined);
      await db.update(emailQueue).set({
        status: "sent", sentAt: new Date(), updatedAt: new Date(), lastError: null,
      }).where(eq(emailQueue.id, item.id));
      sent += 1;
    } catch (error) {
      const attempts = item.attempts + 1;
      const exhausted = attempts >= item.maxAttempts;
      const message = error instanceof Error ? error.message : "Unknown email error";
      await db.update(emailQueue).set({
        attempts,
        status: exhausted ? "failed" : "pending",
        lastError: message,
        updatedAt: new Date(),
      }).where(eq(emailQueue.id, item.id));
      if (exhausted) failed += 1;
      else pending += 1;
      log.error(exhausted ? "Email retry limit reached" : "Queued email retry failed", {
        emailQueueId: item.id, to: item.to, attempts, error: message,
      });
    }
  }
  return { sent, pending, failed };
}
