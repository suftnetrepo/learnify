# AI Tutor Pass: browser and Stripe test-mode UAT (2026-10-23)

## Environment

- Learnify branch `feat/ai-tutor-pass` (`04aaef8`, with fixes in `18296e2`), running locally on port 3001.
- Stripe **test mode** (account "learnif sandbox"):
  - Price `price_1UTlPAIV9M0btl3YamhrUfSN` (£9.99 GBP, one-time);
  - webhooks forwarded with `stripe listen`.
- **Local StudyMind** (`~/dev/studymind-final`) on port 8010, with:
  - an isolated Postgres and Typesense (Docker);
  - `gpt-4.1-mini`;
  - a dedicated local Learnify API key.

  Production StudyMind was never used.
- Neon **development** database `ep-calm-cherry` (not production), with `0010` applied after a `pg_dump` backup.
- Playwright (Chromium) at desktop 1440×900 and mobile (iPhone 13).

## Results

| Journey | Result |
|---|---|
| A. Free course without a pass: purchase card, price, allowances; no token (402) | Pass |
| B. Purchase with test card; verified with the Stripe API; one pass, 30 days; duplicate webhook + confirm create one pass | Pass |
| C. Tutor chat, quiz, flashcards, summary; policy-bound tokens; usage counted; shared across two free courses | Pass |
| D. Paid course tutor unrestricted; existing £19 course checkout + webhook unchanged | Pass |
| E. Renewal queues after the active pass; no second StudyMind policy; future start date shown | Pass |
| F. Refund revokes; StudyMind policy revoked; old token rejected; retry while StudyMind is down; dispute | Pass |
| G. Cancel, expired, declined card, two tabs, bad signature, expired pass, exhausted allowance, flag off | Pass |

Defects found and fixed in `18296e2`:
- CSP blocked non-production StudyMind;
- the usage strip didn't refresh;
- the wrong "last pass" notice;
- "ai" was lower-cased;
- WCAG AA contrast.

Card-only Checkout was added afterwards (release preparation).

## Screenshots (`screenshots/`)

| File | Shows |
|---|---|
| 01 | Purchase card (desktop), before the label/contrast fixes |
| 02 | Stripe Checkout (test mode) — before card-only restriction |
| 03 | "AI Tutor Pass activated" toast after return |
| 04 | Active pass: status strip and StudyMind panel |
| 05 | Tutor chat answer, before the strip auto-refresh fix |
| 06–08 | Generated quiz, flashcards, summary |
| 09 | Usage after one of each feature |
| 10 | Second free course (mobile): same pass, shared usage |
| 11 | Extend card with the future start date |
| 12 | Active plus one queued pass |
| 13 | Refunded state |
| 14 | Expired state (after fix) |
| 15 | Checkout cancelled toast |
| 16 | First tab's session expired by the second checkout |
| 17 | Declined card |
| 18 | Allowance exhausted (StudyMind 429) |
| 19 | Paid course tutor (no pass UI) |
| 20 | Course purchase success page |
| 21–22 | Purchase card and active pass (mobile), after fixes |
| 23 | Feature flag off: free course has no AI tutor |

## Test fixtures (development database only)

- **Accounts:**
  - `uat-studenta@learnify.local` (two passes: active + queued);
  - `uat-studentb@learnify.local` (refunded, disputed and expired passes; one £19 course purchase);
  - `uat-paidstudent@learnify.local` (paid course);
  - `uat-admin@learnify.local`.
- **Courses:** "UAT Free Course A — Cloud Computing Basics", "UAT Free Course B — Git Essentials", "UAT Paid Course — Software Testing Fundamentals".
- Logins and the Playwright scripts are kept **outside git** in `.uat/` (git-ignored). Email to `.local` addresses is never sent.
- The two UAT emails queued in the development `email_queue` were cancelled (marked failed).
