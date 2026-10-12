-- facilitator_handbook_* were added to the schema in ba931b9 without a migration (likely applied
-- with db:push), so drizzle-kit includes them here. IF NOT EXISTS keeps this safe on databases
-- that already have them and fixes databases built purely from migrations.
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "facilitator_handbook_url" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "facilitator_handbook_name" varchar(255);--> statement-breakpoint
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "whiteboard_url" text;
