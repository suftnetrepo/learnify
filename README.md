This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment and database migrations

Production (edquis.com) runs on Render; deploys are driven by GitHub Actions so the database is
always migrated **before** new code goes live.

**How a deploy happens**

1. A change is merged to `main` and the **CI** workflow (type check + build) passes.
2. **Deploy to Production** (`.github/workflows/deploy-production.yml`) then runs automatically:
   it applies any new migrations to the production database (`yarn db:migrate`) and, only if that
   succeeds, triggers a Render deploy through the service's deploy hook.
3. If the migration fails, nothing is deployed and the current version keeps serving. Fix the
   migration and push again.

You can also run it by hand: *Actions → Deploy to Production → Run workflow*, type `DEPLOY`.

**Changing the database schema**

1. Edit the Drizzle schema in `src/db/schema/`.
2. Run `yarn db:generate` to create a migration in `src/db/migrations/` and commit it with the
   schema change.
3. Test it against dev with `yarn db:migrate`.
4. Merge. The deploy workflow applies it to production.

Rules:
- **Never run `db:push` (or `db:push:live`) against production.** It changes the schema without
  recording a migration, and the next deploy's migration can then fail or clash. Production tracks
  applied migrations in `drizzle.__drizzle_migrations`.
- Keep migrations backwards-compatible with the code that is still running. The migration runs a
  few minutes before the new code is live. Add columns as nullable or with defaults; to remove or
  rename a column, stop using it in one deploy and drop it in a later one.

**One-time setup** (already needed for the workflow to run)

| Where | What |
|-------|------|
| GitHub → Settings → Secrets and variables → Actions | `PRODUCTION_DATABASE_URL`: production Postgres connection string |
| GitHub → same place | `RENDER_DEPLOY_HOOK_URL`: from Render → service → Settings → Deploy Hook |
| Render → service → Settings → Build & Deploy | **Auto-Deploy: Off**, so Render only deploys when the workflow triggers it |
