# AI Tutor Pass: production rollout

Status: **not approved for merge or deployment.** Nothing in this document has been run against production.

## What the release contains

- **Migration `0010_ai_tutor_passes`** is additive only. It creates:
  - 4 enums: `ai_pass_payment_status`, `ai_pass_revoke_status`, `ai_pass_checkout_status` and `ai_pass_refund_status`;
  - 2 tables: `ai_tutor_passes` and `ai_pass_checkouts`;
  - their foreign keys to `users`, and 4 indexes.

  It does not alter or drop anything that already exists.
- **Code behind `ENABLE_AI_TUTOR_PASS`** (off unless the value is exactly `"true"`). With the flag off:
  - the student UI and the checkout and confirm endpoints are disabled;
  - free courses behave exactly as before;
  - the Stripe webhook still processes AI Tutor Pass events, so refunds always revoke.
- **One exception to "the flag changes nothing":** with the flag off, the webhook still queries `ai_tutor_passes`, `ai_pass_checkouts` and `purchases` on `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`. **The code must therefore never run before `0010` is applied.** Otherwise those events return 500 (Stripe retries them, so nothing is lost, but they fail until the migration lands).

## Why order matters today

Render auto-deploys every push to `main`. PR #8 (migrate, then deploy via GitHub Actions) is still open. Until it is merged and Render's auto-deploy is turned off, merging this branch would deploy the code before `0010` exists.

## Review of PR #8

PR #8's approach is sound, and it is the safest route for this release:
- It migrates using `drizzle-kit migrate`. Pending migrations are applied in a single transaction, so a failure applies nothing and deploys nothing.
- It runs after CI on the exact commit CI tested.
- Deploys are serialised with `concurrency: production-deploy`.
- It masks the database host in public logs.

Points to confirm when it is merged (it is **not** merged by this work):

1. **Setup order:** set the `PRODUCTION_DATABASE_URL` and `RENDER_DEPLOY_HOOK_URL` secrets and turn off Render auto-deploy **before** merging PR #8. Otherwise the merge deploys twice and Render's copy does not wait for the migration.
2. Production's `drizzle.__drizzle_migrations` is baselined at `0009`, so the first PR #8 run should be a no-op migration. Confirm this in the Actions log before relying on it for `0010`.
3. If the migration succeeds but the Render deploy hook fails, the schema is ahead of the code. That is safe for `0010`, because it is additive. Re-run the workflow manually.

## Safe production sequence

Each step needs explicit approval. Do not combine steps.

1. **Pre-checks (read-only):**
   - On production, `select hash, created_at from drizzle.__drizzle_migrations order by created_at` shows exactly the baseline through `0009`.
   - None of the new type or table names exist yet (`select typname from pg_type where typname like 'ai_pass_%'`, `\dt ai_*`).
   - Take a Neon branch or snapshot of production as a restore point.
2. **Merge PR #8 by itself,** after its setup steps. Watch the first workflow run: the migration should be a no-op, then a deploy should follow. Confirm that edquis.com is healthy.
3. **Rehearse `0010` on a Neon branch of production:**
   - Run `DATABASE_URL=<branch url> yarn db:migrate`.
   - Confirm that only `0010` applies and that `drizzle-kit push` (pointed at the branch, never production) reports no differences.
   - Delete the branch afterwards.
4. **Merge this branch to `main` with the flag off** (`ENABLE_AI_TUTOR_PASS` unset or `"false"` in Render). The PR #8 workflow applies `0010`, then deploys.
5. **Post-deploy checks, with the flag still off:**
   - Course checkout and the course webhook work: a test-mode purchase on staging, or watch the next real purchase.
   - Free courses show no AI tutor.
   - Paid courses' AI tutor works.
   - The webhook log shows no new errors.
6. **Stripe configuration, test mode first:**
   - Create the £9.99 GBP one-time Price and set `STRIPE_AI_PASS_PRICE_ID`.
   - Add `charge.refunded` and `charge.dispute.closed` to the webhook endpoint's events.
   - Schedule `GET /api/cron/ai-pass-revocations` with `Authorization: Bearer $CRON_SECRET` every ~10 minutes.
7. **Enable the flag in staging/test mode** and run the browser checklist (purchase, renewal, refund, dispute, queue limit).
8. **Production enablement** (live Price, flag on) only after legal sign-off on the consent wording and a separate approval.

## Rollback

- **Code:** revert the merge commit. Leaving the `0010` tables in place is safe, because nothing else references them.
- **Feature:** set `ENABLE_AI_TUTOR_PASS=false`. Existing passes stop working, and refunds and disputes are still processed.
- **Schema (only if the release must be removed entirely and no real passes exist):**

  ```sql
  drop table ai_pass_checkouts, ai_tutor_passes;
  drop type ai_pass_checkout_status, ai_pass_refund_status, ai_pass_payment_status, ai_pass_revoke_status;
  ```

  Then delete the `0010` row from `drizzle.__drizzle_migrations`. Never do this once real payments exist.

## Operations

- **`GET /api/ai-pass/admin/issues`** (admins only) lists:
  - StudyMind revocations that keep failing;
  - paid checkouts that need a refund or review.
- With `ADMIN_EMAIL` set, administrators also get an email:
  - at the 5th failed revocation;
  - at the 5th failed automatic refund;
  - for any paid checkout that fails validation or can't be matched to a student.
- Retries continue indefinitely, at most every 6 hours.
