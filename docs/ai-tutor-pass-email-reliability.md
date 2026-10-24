# AI Tutor Pass confirmation email: reliability review

The guarantee is **at-least-once delivery, with provider-side deduplication**. It is **not exactly-once**. A paid pass never depends on the email.

## Design

- **Outbox on the pass row.** When a pass is granted, `confirmation_email_status = 'pending'` is written **in the same database transaction** that creates the pass. The email can't be forgotten, and a failing email can't undo or block the purchase.
- **Worker:** `AiTutorPassService.processPendingConfirmationEmails`. It runs right after fulfilment (webhook or success-page confirmation) and from the existing cron route (`/api/cron/ai-pass-revocations`, every ~10 minutes).
  - Jobs are claimed with `SELECT … FOR UPDATE SKIP LOCKED`, set to `sending`, and the attempt count is incremented, so concurrent workers never process the same email.
  - Outcomes: `sent` (provider message ID stored), `pending` (transient failure, exponential backoff), `failed` (permanent, or 8 attempts), or `skipped` (the pass was revoked first, or the address is a reserved test address).
- **Provider idempotency:** Brevo's transactional API accepts an `idempotencyKey` (a UUID) in the request's `headers` object. A repeated key within its TTL (**30 minutes** per Brevo's batch-email documentation; the 2021 changelog said 15 minutes) is rejected with `duplicate_parameter`. The pass ID is used as the key. `duplicate_parameter` is treated as "already delivered".
  - **Caveat:** Brevo documents this on its batch-email page using `POST /v3/smtp/email`. It doesn't explicitly confirm the behaviour for single sends or give the HTTP status. Learnify detects it by the error code and doesn't rely on it for correctness.
  - The rest of Learnify's email (`sendEmail`) **does not** use idempotency keys. That was existing behaviour and is unchanged.
- **Timeout:** 15 seconds per request (`AbortSignal.timeout`). The shared Brevo sender had no timeout; it now accepts an optional one, and existing callers are unchanged.

## Scenarios

| Scenario | Behaviour |
|---|---|
| Duplicate webhook delivery | The second fulfilment finds the existing pass; the email job is already `sent` or claimed. One email (tested). |
| Concurrent confirmation requests / webhook + cron | `SKIP LOCKED` claim; only one worker sends (tested with 3 concurrent workers). |
| Provider timeout | Recorded as a transient failure, then retried with backoff (1, 2, 4… minutes). A retry within 30 minutes reuses the same key, so if the timed-out request actually succeeded, Brevo deduplicates it. |
| Crash **before** the provider call | The job stays `sending`; after 10 minutes the claim is considered stale and reclaimed. No email is lost. |
| Crash **after** provider acceptance, before recording `sent` | Reclaimed after 10 minutes and resent with the same key, inside Brevo's 30-minute window, so it is deduplicated. **Residual window:** if the resend happens after the provider's TTL (for example, a long outage), the student can get a second copy. |
| Brevo's own internal retries (network errors, 5xx) | Same request body, so the same key; deduplicated. |
| Failed retries | Exponential backoff, capped at 6 hours; stops after 8 attempts with status `failed`. |
| Permanent failure (recipient rejected, 4xx other than 429) | `failed` immediately, never retried automatically. |
| Missing recipient address | `failed` ("Student has no email address"). |
| Refund or dispute before delivery | `revoke()` moves a `pending` email to `skipped` ("pass refunded"); the worker also skips revoked passes. No confirmation for a revoked pass (tested). |
| Email not configured (no Brevo key) | Transient: retried until the attempt limit, then `failed` and alerted. |
| Pass lost because the email failed? | No. The pass is committed before any email work, and email errors are caught (tested). |

## Administrator visibility

- `GET /api/ai-pass/admin/issues` → `confirmationEmails`: every `failed` email, and every `pending` one with at least one failed attempt (status, attempts, last error, next attempt).
- With `ADMIN_EMAIL` set, an alert is sent ("Purchase confirmation email could not be delivered") when an email becomes `failed`.
- **To resend:** fix the cause, then set `confirmation_email_status = 'pending'` and `confirmation_email_next_attempt_at = now()` for that pass. The next cron run sends it with the same idempotency key.

## Development and UAT

- `EMAIL_SINK_DIR` (ignored when `NODE_ENV=production`) writes emails to files instead of sending them. It was used for the browser UAT.
- Mail to reserved test domains (`.local`, `.test`, `.example`, `.invalid`, `.localhost`) is never sent.
