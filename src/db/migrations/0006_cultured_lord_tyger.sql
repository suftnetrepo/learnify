ALTER TABLE "users" ADD COLUMN "headline" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "linkedin_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "github_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "twitter_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "years_experience" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "languages" text[];--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "expertise" text[];--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "experience" jsonb;