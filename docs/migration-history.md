# Migration history: known gap

This issue predates the AI Tutor Pass work and is separate from it.

## The problem

`src/db/migrations` cannot build a database from scratch. Replaying `0000` onwards on an empty database fails at `0001_flippant_crusher_hogan.sql`:

```
ALTER TABLE "courses" ADD COLUMN "handout_url" text;
-- relation "courses" does not exist
```

No migration creates the core tables:
- `users`, `courses`, `course_sections`, `lectures`;
- `enrollments`, `purchases`, `course_sessions`;
- the remaining tables that appear only in `ALTER` statements.

`0000_lyrical_microchip.sql` only creates `email_queue`. The original schema was created with `drizzle-kit push`, and the journal starts after that point.

## Impact

- **Production is not affected.** It tracks applied migrations in `drizzle.__drizzle_migrations`, baselined at `0009`, so `drizzle-kit migrate` only applies new files (`0010` onwards).
- **A new environment (staging, a fresh developer database, CI) cannot be built with `yarn db:migrate`.** It needs `yarn db:push` instead.
- **Migration SQL is not exercised from an empty database anywhere.**

## How the AI Tutor Pass migration was verified instead

On a throwaway local Postgres (`127.0.0.1:55433`):
1. `drizzle-kit push` built the current schema.
2. The `0010` objects were dropped.
3. `0010_ai_tutor_passes.sql` was applied as written.
4. `drizzle-kit push` then reported **"No changes detected"**: the migration produces exactly the schema in code.

The Vitest suite runs against that database.

## Options to fix (not done; needs a decision)

1. **Squash to a new baseline:**
   - generate a single baseline migration from the current schema for fresh databases only;
   - mark it as applied in production with a manual row in `drizzle.__drizzle_migrations`.

   Fresh environments then use `migrate`. This needs a careful, reviewed production bookkeeping change.
2. **Keep `push` for fresh environments** and document it, accepting that migration SQL is only tested incrementally (as above).
3. **Add a CI job** that builds a throwaway database with `push` at `main`'s schema, then applies the branch's new migrations and diffs. This checks each new migration the same way `0010` was checked.
