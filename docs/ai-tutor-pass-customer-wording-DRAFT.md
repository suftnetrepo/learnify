# AI Tutor Pass: customer wording (DRAFT)

> **DRAFT — NOT LEGALLY APPROVED.** This is an engineering inventory and a proposal for legal and tax review. Nothing here is legal advice, and none of the proposed wording is live. The text currently in the app (section 1) is also unapproved.

## 1. Text currently shown to customers

| # | Where | Current text |
|---|---|---|
| C1 | Purchase card, heading | "Your personal AI tutor for free courses" (renewal: "Keep your AI tutor going") |
| C2 | Purchase card | "Ask questions, generate quizzes, flashcards and summaries from your course content." |
| C3 | Purchase card, price | "£9.99 · one-time · 30 days · no subscription" |
| C4 | Purchase card | "Included every day: 60 AI tutor questions · 5 practice quizzes · 5 flashcard sets · 3 lecture summaries" |
| C5 | Purchase card | "Allowances reset daily at midnight UK time. A fair-use limit also applies. Works on all your free courses." |
| C6 | Renewal note | "This pass will start on {date}, when your current one ends, and run for 30 days." |
| C7 | **Consent checkbox** | "I want access to the AI Tutor Pass to begin immediately [renewal: as described above]. I understand that once access begins I lose my right to cancel within 14 days." |
| C8 | Button | "Get AI Tutor Pass · £9.99" / "Add 30 days for £9.99" · "Secure payment by Stripe" |
| C9 | Stripe Checkout | "One-time payment — not a subscription. Your 30-day AI Tutor Pass starts straight away, or when your current pass ends if you already have one." |
| C10 | Status strip | "Active until {date}" · "Your AI Tutor Pass ends in {n} days. Extend now to keep your tutor." |
| C11 | Status strip | "You've reached today's fair-use limit. It resets at midnight UK time." |
| C12 | StudyMind panel (StudyMind's text) | "You've used today's 60 tutor questions. Your allowance resets at midnight (UK time)." |
| C13 | Notices | "Your AI Tutor Pass was refunded, so it's no longer active." · "Your last AI Tutor Pass ended on {date}." · "Your AI Tutor Pass is paused because the payment is disputed. Contact support for help." |
| C14 | Payment outcomes | "…arrived after you'd reached the pass limit, so it has been refunded." · "We couldn't verify this payment. Our team has been alerted…" · "This payment was refunded or disputed, so no pass was added." · "You already have an active pass and 2 upcoming passes" |
| C15 | Toasts | "AI Tutor Pass activated" · "Checkout cancelled — You haven't been charged." · "Payment processing…" |

## 2. Points needing legal or tax approval

1. **Price and VAT (C3, C8, C9).**
   - Is £9.99 VAT-inclusive?
   - The site Terms (§4) say prices "include applicable taxes".
   - Does VAT need to be shown, and are non-UK (EU) buyers in scope?
2. **What the pass legally is.**
   - Under the Consumer Contracts Regulations 2013, *digital content* and *services* have different cancellation rules. An interactive AI tutor may be classed as a service, in which case the right to cancel is not simply lost when access begins: a proportionate charge may apply instead.
   - The consent wording (C7) depends on this classification.
3. **Consent and confirmation (C7).**
   - Losing the 14-day right normally requires express consent and acknowledgement *and* a confirmation on a durable medium (for example email) that records them.
   - **The app currently sends no AI Tutor Pass confirmation email.** It relies on Stripe's receipt, if enabled, which does not mention the consent.
   - The consent time is stored (`consent_at`) but is not communicated to the customer.
4. **Queued renewals (C6, C7).** A renewal can start up to 60 days later. "Begin immediately" does not fit. Legal should decide whether the cancellation right persists until a queued pass starts, and whether Learnify should refund cancelled queued passes. Technically, revoking an unstarted pass is supported.
5. **Fair use and the AI cost budget (C5, C11).**
   - Besides the published allowances, StudyMind applies a hidden daily AI cost budget ($4.50 per pass), so a feature can stop before its allowance is used up.
   - "A fair-use limit also applies" may be too vague: it could be a misleading omission under consumer protection rules. Proposed clearer text is in section 3.
6. **Duration (C3, C10).** "30 days" means exactly 30 × 24 hours from the start time, and the end date is shown. Confirm this is acceptable versus "30 calendar days" or "until the end of day 30".
7. **Refund policy.**
   - The Terms' 30-day money-back guarantee covers *courses*; nothing covers the pass.
   - Decide the pass refund policy (for example none once used, statutory rights only, or within 14 days if unused).
   - Add an AI Tutor Pass section to the Terms.
   - Technical behaviour: a full refund ends access immediately; a partial refund keeps access.
8. **Disputes (C13).** Access is withdrawn when a chargeback is opened and is not automatically restored if the dispute is won. "Paused" may overstate it; consider "suspended".
9. **Scope (C1, C5).** It works only on free courses the student is enrolled in (paid courses already include the AI tutor). "Works on all your free courses" should say "free courses you're enrolled in".
10. **AI accuracy.** There is no notice that AI answers may be inaccurate. Consider a short disclaimer.
11. **Limit of passes (C14).** At most one active and two upcoming passes. A payment over the limit is refunded automatically. Should this be stated before purchase?

## 3. Proposed wording (DRAFT, for review)

**Price line (C3):**
> £9.99 one-time payment (incl. VAT) · 30 days of access · not a subscription — it won't renew automatically.

**Allowances and fair use (C4, C5):**
> Each day you can ask up to 60 tutor questions and create up to 5 quizzes, 5 flashcard sets and 3 lecture summaries. Allowances reset at midnight UK time and unused allowances don't carry over. To keep the service fair for everyone, features may pause for the rest of the day if usage is unusually high. Works on the free courses you're enrolled in.

**Renewal note (C6):**
> You already have an active pass. This pass will start automatically on {date}, when your current pass ends, and will last 30 days. You can hold up to two upcoming passes.

**Consent: immediate start (C7). Wording depends on point 2:**
> ☐ I ask for my AI Tutor Pass to start immediately. I understand that by starting it now, I lose my right to cancel within 14 days [*legal: or "I will pay for any use before I cancel" if the pass is a service*].

**Consent: queued renewal (C7):**
> ☐ I understand this pass will start on {date}. [*Legal to confirm cancellation rights before it starts.*]

**Below the button:**
> By buying, you agree to the AI Tutor Pass terms [link]. AI answers can be inaccurate — check important information against your course materials.

**Dispute notice (C13):**
> Your AI Tutor Pass has been suspended because the payment is being disputed. Please contact support.

**Confirmation email (new, required if point 3 is confirmed):**
> Subject: Your AI Tutor Pass receipt
> You bought an AI Tutor Pass for £9.99 on {date}. It runs from {start} to {end}. You asked for access to start immediately and acknowledged that this ends your right to cancel within 14 days [*per legal outcome*]. Daily allowances: … Need help? {support link}

**Terms of Use, new section (outline):** what the pass includes; allowances and fair use; duration and start date; queued passes and the limit; cancellation rights and refunds; disputes; changes and availability of the AI service; AI accuracy.

## 4. Before launch

- [ ] Legal decision on classification, consent wording and cancellation rights (points 2–4).
- [ ] Tax decision on VAT presentation (point 1).
- [ ] Refund policy written and added to the Terms (point 7).
- [ ] Confirmation email designed and implemented, if required.
- [ ] Approved wording applied to the app, and this document's status changed from DRAFT.
