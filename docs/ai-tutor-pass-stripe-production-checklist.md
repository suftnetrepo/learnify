# AI Tutor Pass: Stripe production checklist

Status: **checklist only.** No live Stripe objects have been created. Each step needs approval, and the person doing it should tick it off and record who and when.

Test-mode reference (UAT, 2026-10-23):
- Product `prod_VUkvHgrdAQ7VRt`, Price `price_1UTlPAIV9M0btl3YamhrUfSN`;
- account `acct_1U5PkRIV9M0btl3Y` ("learnif sandbox").

## 1. Account ownership and settlement

- [ ] Confirm the **live** account that course payments use (the one behind production's `STRIPE_SECRET_KEY`). Record its account ID and legal business name.
- [ ] Confirm the account owner and the people with Administrator access. Remove anyone who no longer needs it.
- [ ] Confirm the payout bank account and schedule. AI Tutor Pass revenue is platform revenue: no Connect transfer or application fee.
- [ ] Confirm the statement descriptor customers will see (it should be recognisable, to reduce disputes).
- [ ] Confirm the **Managed Payments** setting. Learnify opts out per session (`managed_payments: { enabled: false }`), the same as course checkout.

## 2. VAT and tax (needs accountant/legal sign-off)

- [ ] Decide whether £9.99 is VAT-inclusive. The site's Terms say prices "include applicable taxes".
- [ ] Confirm Learnify's VAT registration status and number, and whether VAT must be shown on the Checkout page or receipt.
- [ ] Decide on Stripe Tax:
  - if used, set a tax code on the live Product (for example an electronically supplied service) and decide `tax_behavior` (`inclusive` if £9.99 is the final price);
  - if not used, record why, and how VAT is accounted for.
- [ ] Non-UK buyers: digital services sold to EU consumers may trigger EU VAT (OSS). Decide whether to restrict buyers or register.
- [ ] Confirm receipts and invoices meet the requirements (Stripe receipt emails on/off for this account).

## 3. Live Product and Price

- [ ] Create the live Product: **"Learnify AI Tutor Pass — 30 Days"**, with metadata `learnify_kind=ai_tutor_pass` (and tax code if decided above).
- [ ] Create the live Price: **one-time**, **GBP**, `unit_amount` **999**, `tax_behavior` per section 2.
- [ ] Verify it read-only with the Stripe API: `livemode: true`, `type: one_time`, `unit_amount: 999`, `currency: gbp`, `recurring: null`.
- [ ] Record the live Price ID here: `price_…`

## 4. Application configuration (Render)

- [ ] `STRIPE_AI_PASS_PRICE_ID` = the live Price ID. Checkout returns 503 while it is unset, and fulfilment re-checks the amount and currency.
- [ ] `ENABLE_AI_TUTOR_PASS` stays `"false"` until the launch approval.
- [ ] `CRON_SECRET` set (a long random value).
- [ ] `ADMIN_EMAIL` set to a monitored mailbox. Pass alerts and the existing dispute alerts go there.
- [ ] `STUDYMIND_API_URL` / `STUDYMIND_API_KEY` are production values. Production StudyMind must include the usage-policy release (StudyMind `origin/main` `c045a0a`, verified 2026-10-23).
- [ ] **UK-only launch:** add a Radar rule so non-UK cards are blocked before charge for pass payments, for example `Block if :card_country: != 'GB' and ::kind:: = 'ai_tutor_pass'` (metadata on the PaymentIntent). The app also enforces a UK billing address and UK card at fulfilment, and refunds anything else automatically.
- [ ] Checkout is card-only for launch (`payment_method_types: ["card"]`, in code). Apple Pay and Google Pay still appear as card wallets. Other methods would need their own refund and dispute testing first.

## 5. Webhook endpoint

The production endpoint is `https://edquis.com/api/webhooks/stripe` (the existing course endpoint; do not create a second one).

- [ ] Add these events to the **existing** live endpoint, keeping the current ones:
  - `charge.refunded` (new)
  - `charge.dispute.closed` (new)
  - already needed: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `payment_intent.payment_failed`, `charge.dispute.created`
- [ ] Confirm the API version of the endpoint is compatible with the SDK (`2026-07-29.dahlia`).
- [ ] Confirm `STRIPE_WEBHOOK_SECRET` in Render is this endpoint's live signing secret (`whsec_…`). Do not reuse a CLI or test secret.
- [ ] **Signature check:** after deploy, send a test event from the Dashboard ("Send test webhook"). It should show 200. A request with a bad signature should get 400 (verified in UAT).
- [ ] Watch the endpoint's delivery log for 24 hours after enablement. There should be no 4xx or 5xx.

## 6. Revocation and refund cron

- [ ] Schedule `GET https://edquis.com/api/cron/ai-pass-revocations` every **10 minutes** with header `Authorization: Bearer $CRON_SECRET` (the same mechanism as `/api/cron/email`).
- [ ] Confirm it returns 401 without the header and 200 with it. The response contains `{ revocations, refunds }` counts.
- [ ] Alert if the cron stops running. Failing jobs also appear at `GET /api/ai-pass/admin/issues` (admins only).

## 7. Go-live smoke test (after approval, flag on)

- [ ] One real £9.99 card purchase by a staff account on a free course: the pass becomes active and the tutor works.
- [ ] Refund it from the Dashboard: the pass is revoked within a minute, and the StudyMind policy is revoked (admin issues list is empty).
- [ ] Confirm the course checkout still works (an existing paid course).
