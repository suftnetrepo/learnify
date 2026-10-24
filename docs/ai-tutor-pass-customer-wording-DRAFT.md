# AI Tutor Pass: customer terms, consent and confirmation email (DRAFT)

> **DRAFT — NOT LEGALLY APPROVED.** The wording below is implemented behind the (disabled) feature flag so it can be reviewed in context. It is not legal advice and is not in force. Terms version: `2026-10-24-draft.1`.

## Where the wording lives

| Item | Source |
|---|---|
| Terms (12 sections), version, support contact, tax note, acknowledgement text | `src/lib/ai-pass/terms.ts` — the single source |
| Terms page | `/terms/ai-tutor-pass` (shows a "Draft for legal review" banner; 404 while the feature flag is off) |
| Purchase card and consent UI | `src/components/ai-pass/AiTutorPassCard.tsx` |
| Confirmation email | `EmailService.aiTutorPassConfirmation` in `src/services/email.service.ts` |
| Email previews | `docs/ai-tutor-pass-email-previews/` (immediate start and queued renewal) |

## Key facts the wording must reflect

- £9.99 one-time card payment; 30 consecutive days (30 × 24 hours); no subscription and no automatic renewal.
- Only for free courses the student is enrolled in. Paid courses already include the AI tutor.
- Each day: 60 tutor questions, 5 quizzes, 5 flashcard sets and 3 summaries. The allowance is shared across all eligible courses and resets at midnight UK time.
- **A total fair-use (AI cost) budget per pass ($4.50 of AI usage over the whole 30 days, not per day).** It never resets. When it runs out, the AI tutor stops for that pass even if days remain. The price of £9.99 is never described as "unlimited".
- Further purchases queue after the latest pass (one active and at most two upcoming). A payment over the limit is refunded automatically.
- A full refund ends access immediately; a partial refund does not. A dispute suspends access, and it is not restored automatically.

## Purchase consent design (implemented)

1. **Terms acceptance: required, never pre-ticked.** "I have read and agree to the AI Tutor Pass Terms (version X)." The link opens the versioned terms in a new tab.
2. **Immediate-access acknowledgement: separate, optional, never pre-ticked.**
   - Shown only when the pass would start straight away.
   - Text: "I ask for my AI Tutor Pass to start immediately, within the 14-day cancellation period. I understand this affects my right to cancel, as explained in the AI Tutor Pass Terms."
   - Help text: "Optional. If you leave this unticked, your pass still starts straight away and you keep your 14-day right to cancel."
   - **Statutory cancellation rights are never removed automatically.** Whether this acknowledgement should become required is a legal and business decision: `AI_PASS_TERMS.immediateAccessAckRequired`, currently `false`.
3. **Queued renewals:** no acknowledgement is offered (the pass starts later). The card states that the pass can be cancelled for a full refund before it starts *(proposed policy)*.
4. **Server checks:**
   - `acceptTerms` must be literally `true`;
   - `termsVersion` must equal the current version (otherwise 409 `TERMS_OUTDATED`, and the student must review again);
   - `immediateAccess` must be sent explicitly (boolean).
5. **Recorded** on `ai_pass_checkouts` when checkout starts (server time), then copied to `ai_tutor_passes`:
   - terms version;
   - consent timestamp;
   - student ID;
   - Checkout Session ID;
   - the immediate-access choice (stored as false for queued passes).

   The same values go into Stripe metadata as a backup.
6. **Accessibility:** a fieldset with a hidden legend; labelled checkboxes; `aria-required` on the terms box; help text linked with `aria-describedby`; the link announces "opens in a new tab"; errors use `role="alert"`; the button stays disabled until the terms are accepted.

## Confirmation email (implemented)

Delivered through an outbox on the pass row, with the pass ID as Brevo's idempotency key: **at-least-once, provider-deduplicated, not exactly-once.** See `docs/ai-tutor-pass-email-reliability.md`. It is never sent for a payment that wasn't granted, or for a pass revoked before delivery. It reuses the existing Brevo email layer and template; course emails are unchanged.

Contents:
- **Subject:** "Your AI Tutor Pass is confirmed", or "Your next AI Tutor Pass starts {date}" for a queued pass.
- **Details:** total paid £9.99 (one-time, not a subscription); start and end dates and times (UK time); a reference.
  - For queued passes: "it will start automatically on {date}".
  - A tax line appears only once `AI_PASS_TERMS.taxNote` is set.
- **What's included:** daily allowances, shared across courses, resetting at midnight UK time.
- **Fair-use limit:** not unlimited; a total limit per pass; access can stop before the end date; no reset at midnight.
- **No automatic renewal.**
- **Cancellation and refunds**, one of three variants:
  - no immediate access → "you keep your right to cancel within 14 days — until {date}";
  - immediate access → quotes the acknowledgement and when it was given, and points to Terms §6;
  - queued → can be cancelled for a full refund before {start date}.

  All variants add: refund timing, full refund ends access, statutory rights not affected.
- A link to the AI Tutor Pass Terms with the accepted version, and the support email.

## Fair-use transparency (implemented in the status strip)

StudyMind's server-to-server policy endpoint (API key) returns the pass's budget: `total_usd`, `spent_usd`, `reserved_usd` and `remaining_usd`, plus per-feature `available` and `budget_exhausted`. That is enough to show meaningful remaining overall allowance. StudyMind was not changed.

The AI tutor drawer shows three things, kept visually separate:

| Concept | What the student sees |
|---|---|
| 30-day expiry | "Active until 23 Nov 2026" (plus "(1 more queued)") |
| Daily feature allowances | "Left today · resets at midnight UK time", with tiles for 60 questions, 5 quizzes, 5 sets and 3 summaries |
| Pass-level fair-use budget | "Fair-use left for this pass — about 80%", a progress bar, and "Covers the whole pass, separate from the daily limits above, and doesn't reset at midnight." At 20% or less: amber, plus "Running low — when it's used up, the AI tutor stops for this pass." When used up: "You've reached this pass's total fair-use limit, so the AI tutor is no longer available on it. It doesn't reset at midnight." |

- The percentage is rounded **down** to 5%, so it never overstates what's left.
- **Dollar amounts are never sent to the browser.** Previously the raw StudyMind payload, including `budget` in USD, reached the student; it is now removed and replaced by the summary.
- The $4.50 cap is unchanged (a StudyMind setting).

## Corrections made in this revision

- The status strip previously said the fair-use limit "resets at midnight UK time". It doesn't (it's per pass). Now: "You've reached this pass's total fair-use limit, so the AI tutor is no longer available on it. It doesn't reset at midnight."
- The earlier draft of this document called the AI cost budget "daily". It is **per pass**.

## Decisions needed from a UK consumer-law adviser (short list)

1. Is the AI Tutor Pass **digital content** or a **digital service** (CCR 2013 / CRA 2015)?
2. Is the **immediate-access acknowledgement** wording valid express consent and acknowledgement? Should it be **optional** (as built) or **required**?
3. If a student cancels within 14 days **without** the acknowledgement: **full refund**, or a deduction for access used?
4. **Queued passes:** when does the cancellation period run, and is "full refund before the start date" right?
5. Is the **confirmation email** (with a link to versioned terms) an adequate durable-medium confirmation, or must the terms be attached?
6. Must the **fair-use limit** be stated in numbers, or is the percentage indicator plus the explanation enough?
7. **Remedies** for faulty or unavailable service, and the **dispute** suspension policy.
8. Wording for the **main Terms** referencing the pass, and whether the course "30-day money-back guarantee" needs an explicit carve-out there.

Nothing here declares the cancellation terms legally compliant.

## Outstanding legal questions (professional review required)

1. **Classification:** is the pass *digital content* or a *digital service* under the Consumer Contracts Regulations 2013 and the Consumer Rights Act 2015? This decides what happens when a student cancels after access begins (no right to cancel, or a proportionate charge), and so the final text of Terms §6 and the acknowledgement.
2. **Acknowledgement text:** is the drafted wording sufficient for express consent and acknowledgement? Should it be required, or stay optional as implemented?
3. **Refund amount without the acknowledgement:** a full refund within 14 days, or a deduction for access used (Terms §6, marked `[LEGAL REVIEW]`)?
4. **Queued passes:** confirm the proposed "full refund before start" policy, and when the 14-day period runs for a pass bought now that starts later.
5. **Durable medium:** does the confirmation email satisfy the confirmation requirement? Should it include the full terms text (or a PDF) rather than a link?
6. **Fair-use disclosure:** is "total fair-use limit" without a number adequate, or must the limit (or typical usage) be quantified? The budget is $4.50 of AI cost per pass; it is internal and in US dollars.
7. **Faulty or unavailable service:** confirm remedies (Terms §8) and the proposed extend-or-refund policy for outages.
8. **Disputes:** is suspending access during a dispute, with no automatic restoration, acceptable?
9. **Pass exhausted early and queued passes:** a queued pass starts on its scheduled date even if the current pass's budget ran out earlier, so the student may have a gap. Is that acceptable to disclose, or should an exhausted pass end early? (That would be a product change.)
10. **Main Terms of Service:** add a reference to the AI Tutor Pass Terms in §4 (not done, to keep draft text off the live Terms page).
11. **Clock change:** "30 consecutive days" is 720 hours, so around a UK clock change the displayed end time is an hour different from the start time. Is that acceptable?

## Outstanding VAT and tax questions (accountant review)

1. Is Learnify VAT-registered, and is £9.99 VAT-inclusive? The app currently makes **no VAT claim** (`taxNote` is null). The main Terms say prices "include applicable taxes".
2. What must the receipt or confirmation show (VAT amount, VAT number, supplier details)?
3. Stripe Tax and the product tax code, if used.
4. Buyers outside the UK (EU OSS for digital services): accept, restrict, or register?
5. Approved wording for `AI_PASS_TERMS.taxNote`, shown on the card and in the email once set.
