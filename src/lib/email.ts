import { eq } from "drizzle-orm";
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

function config() {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !fromEmail) throw new EmailNotConfiguredError();
  return { apiKey, fromEmail, fromName: process.env.BREVO_FROM_NAME ?? "Learnify" };
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

async function sendViaBrevo(to: string, subject: string, html: string, text?: string): Promise<void> {
  const { apiKey, fromEmail, fromName } = config();
  cachedSender ??= new BrevoEmailSender(apiKey);
  const result = await cachedSender.sendEmail({
    sender: { email: fromEmail, name: fromName },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text ?? plainText(html),
  });
  if (!result.success) throw new Error(`Brevo rejected the email: ${result.error}`);
  log.info("Email sent", { to, subject, messageId: result.messageId });
}

/** Send immediately, then durably queue any failure without breaking the business operation. */
export async function sendEmail(to: string, subject: string, html: string, context = subject): Promise<void> {
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
