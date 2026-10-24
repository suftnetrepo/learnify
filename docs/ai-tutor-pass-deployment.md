# AI Tutor Pass: production rollout

Status: **prepared, not approved for merge or deployment.** Nothing in this document has been run against production.

## Exact remaining actions (2026-10-24)

Verified: the read-only production check passed (journal `0000`–`0009`, hashes match, no `ai_*` objects, `users.id` uuid, PostgreSQL 18.6). `yarn db:migrate` was rehearsed on a schema-only copy of production: only `0010` and `0011` applied, the schema matched the code, and a re-run was a no-op.

**Blocked on business facts (needed before enabling the flag):**
1. Confirm whether Edquis Ltd is VAT-registered (and the VAT number if so). Then set `AI_PASS_TERMS.taxNote` (and Stripe Tax / `tax_behavior` if registered).
2. Confirm the company number and registered office address. Then set `AI_PASS_TERMS.trader`, set `approved: true`, and bump `version`.

**Deployment (each needs your approval):**
3. Create the GitHub environment with a reviewer: `gh api -X PUT repos/suftnetrepo/learnify/environments/production -F 'reviewers[][type]=User' -F 'reviewers[][id]=<your GitHub user id>'`
4. Add the secrets (values from Neon and Render; use the **direct**, non-pooler Neon URL):
   - `gh secret set PRODUCTION_DATABASE_URL --env production`
   - `gh secret set RENDER_DEPLOY_HOOK_URL --env production`
5. Render dashboard → service → Settings → Build & Deploy → **Auto-Deploy: Off**.
6. Merge PR #8 alone and confirm its first run migrates nothing, then deploys.
7. Merge `feat/ai-tutor-pass`, with Render env `ENABLE_AI_TUTOR_PASS=false` (or unset). The workflow applies `0010` and `0011`, then deploys.
8. Stripe live (see the checklist):
   - create the £9.99 Price → `STRIPE_AI_PASS_PRICE_ID`;
   - add `charge.refunded` and `charge.dispute.closed` to the live endpoint;
   - add a Radar block rule for non-UK cards on pass payments;
   - set `CRON_SECRET` and `ADMIN_EMAIL`, and schedule `/api/cron/ai-pass-revocations` every 10 minutes.
9. Production StudyMind must be on the usage-policy release (`c045a0a`).
10. After steps 1, 2 and 8: set `ENABLE_AI_TUTOR_PASS=true` and run the go-live smoke test.

## What the release contains

- **Migration `0010_ai_tutor_passes`** is additive only. It creates:
  - 4 enums: `ai_pass_payment_status`, `ai_pass_revoke_status`, `ai_pass_checkout_status` and `ai_pass_refund_status`;
  - 2 new tables: `ai_tutor_passes` and `ai_pass_checkouts`;
  - their foreign keys to `users(id)`, and 4 indexes.

  It does not alter or drop anything that already exists.
- **Migration `0011_ai_pass_consent`** adds nullable or defaulted columns to the two new tables only: the terms version, consent time and immediate-access choice, plus the confirmation-email claim. It is additive and verified to apply cleanly after `0010`.
- **Code behind `ENABLE_AI_TUTOR_PASS`** (off unless the value is exactly `"true"`). With the flag off:
  - the student UI and the checkout and confirm endpoints are disabled;
  - free courses behave exactly as before (verified in browser UAT);
  - the Stripe webhook still processes AI Tutor Pass events, so refunds always revoke.
- **One exception to "the flag changes nothing":** with the flag off, the webhook still queries `ai_tutor_passes`, `ai_pass_checkouts` and `purchases` on `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`. **The code must therefore never run before `0010` is applied.** Otherwise those events return 500 (Stripe retries them, so nothing is lost, but they fail until the migration lands).

## PR #8 review (2026-10-24)

PR #8 (`ci/migrate-before-deploy`, head `80b8c19`) is **mergeable and clean**, and **does not conflict with this branch** (it changes only `deploy-production.yml` and `README.md`).

| Requirement | Finding |
|---|---|
| Migrations run before deployment | ✅ Within one job, `yarn db:migrate` runs before the Render deploy-hook step. It is triggered only by a successful CI run for a push to `main` (or a manual `DEPLOY`), on the exact commit CI tested. |
| A migration failure prevents deployment | ✅ A failed step stops the job, so the deploy step never runs. Drizzle (`drizzle-orm` 0.45.2, `pg-core/dialect.js`) applies all pending migrations inside **one transaction**: a failure applies nothing. |
| Existing migrations are not replayed | ✅ The migrator reads the latest `created_at` from `drizzle.__drizzle_migrations` and applies only journal entries with a later timestamp. Production is baselined at `0009` (per PR #8). `0010` (`when` 1792770334242) and `0011` are later, so only those two apply, together in one transaction. |
| `0010` is compatible with production | ✅ By design (additive, new names, FK to the existing `users.id uuid` primary key, `gen_random_uuid()` needs PG 13+). **To be confirmed by the authorised read-only check below**, which has not been run. |
| Production secrets are configured | ❌ **Not configured.** The repository has **0 Actions secrets** and no `production` environment (checked with admin access via the GitHub API, names only). `PRODUCTION_DATABASE_URL` and `RENDER_DEPLOY_HOOK_URL` must be added before PR #8 is merged. Until then the workflow stops at "Check secrets are configured" and deploys nothing. |
| Render auto-deploy is off | ❓ **Cannot be checked from here** (no Render API access). It must be confirmed in the Render dashboard. While it is on, every merge to `main` deploys **without** migrating. |
| Rollback documented | ✅ See "Rollback" below. |

Further recommendations:

- **Use Neon's direct endpoint, not the `-pooler` one, for `PRODUCTION_DATABASE_URL`.** postgres.js uses prepared statements, and migrations should not run through a transaction-mode pooler.
- **Create the `production` GitHub environment explicitly**, with required reviewers, and store the two secrets there. The workflow already declares `environment: production`, so each production migration and deploy then needs a human approval.
- **This branch adds a `Tests` job to CI** (Vitest against a throwaway Postgres service), so the deploy workflow, which waits for CI to succeed, is gated on the payment and concurrency tests.

## Authorised read-only production check (not yet run)

Run only with explicit approval, against production, read-only:

```sql
select version();                                                                -- PostgreSQL 13+ (gen_random_uuid)
select count(*), max(created_at) from drizzle.__drizzle_migrations;              -- baseline through 0009
select max(created_at) < 1792770334242 as only_0010_0011_pending from drizzle.__drizzle_migrations;
select typname from pg_type where typname like 'ai_pass_%';                      -- expect 0 rows
select table_name from information_schema.tables where table_name like 'ai_%';   -- expect 0 rows
select data_type from information_schema.columns where table_name = 'users' and column_name = 'id';  -- uuid
```

## Safe production sequence

Each step needs explicit approval. Do not combine steps.

1. **Run the read-only production check above,** and take a Neon branch of production as a restore point.
2. **Prepare PR #8:**
   - create the `production` environment (with reviewers);
   - add `PRODUCTION_DATABASE_URL` (direct endpoint) and `RENDER_DEPLOY_HOOK_URL`;
   - turn **off** Render auto-deploy.
3. **Merge PR #8 by itself.** Watch the first workflow run: the migration should be a no-op, and a deploy should follow. Confirm that edquis.com is healthy.
4. **Rehearse `0010` and `0011` on the Neon branch:**
   - run `DATABASE_URL=<branch direct url> yarn db:migrate`;
   - confirm only `0010` and `0011` apply, and that `drizzle-kit push` (pointed at the branch, never production) reports no differences;
   - delete the branch afterwards.
5. **Merge this branch to `main` with the flag off** (`ENABLE_AI_TUTOR_PASS` unset or `"false"` in Render). CI (including tests) runs, then the PR #8 workflow applies `0010` and `0011`, then deploys.
6. **Post-deploy checks, with the flag still off:**
   - course checkout and the course webhook work;
   - free courses show no AI tutor;
   - paid courses' AI tutor works;
   - the webhook log shows no new errors.
7. **Stripe live configuration:** see `docs/ai-tutor-pass-stripe-production-checklist.md`.
8. **Production enablement** (flag on) only after legal and tax sign-off (`docs/ai-tutor-pass-customer-wording-DRAFT.md`) and a separate approval.

## Rollback

- **Feature:** set `ENABLE_AI_TUTOR_PASS=false` and redeploy (or restart). The UI and purchases stop; refunds and disputes are still processed.
- **Code:** revert the merge commit; CI and the deploy workflow redeploy the previous code. Leaving the `0010` tables in place is safe, because nothing else references them.
- **Failed migration:** nothing is applied (single transaction) and nothing is deployed. Fix forward, then re-run the workflow.
- **Schema (only if the release must be removed entirely and no real passes exist):**

  ```sql
  drop table ai_pass_checkouts, ai_tutor_passes;
  drop type ai_pass_checkout_status, ai_pass_refund_status, ai_pass_payment_status, ai_pass_revoke_status;
  delete from drizzle.__drizzle_migrations where created_at >= 1792770334242;   -- the 0010 and 0011 rows
  ```

  Never do this once real payments exist; restore from the Neon branch instead if needed.

## Operations

- **`GET /api/ai-pass/admin/issues`** (admins only) lists:
  - StudyMind revocations that keep failing;
  - paid checkouts that need a refund or review.
- With `ADMIN_EMAIL` set, administrators also get an email:
  - at the 5th failed revocation;
  - at the 5th failed automatic refund;
  - for any paid checkout that fails validation or can't be matched to a student.
- Retries continue indefinitely, at most every 6 hours.
- **Email safety:** mail to reserved test domains (`.local`, `.test`, `.example`, `.invalid`, `.localhost`) is never sent, so UAT fixture accounts cannot generate real email. Development must never use production Brevo credentials.
