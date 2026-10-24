CREATE TYPE "public"."ai_pass_email_status" AS ENUM('not_required', 'pending', 'sending', 'sent', 'failed', 'skipped');--> statement-breakpoint
ALTER TABLE "ai_pass_checkouts" ADD COLUMN "terms_version" varchar(32);--> statement-breakpoint
ALTER TABLE "ai_pass_checkouts" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_pass_checkouts" ADD COLUMN "immediate_access_ack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "terms_version" varchar(32);--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "immediate_access_ack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "confirmation_email_status" "ai_pass_email_status" DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "confirmation_email_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "confirmation_email_next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "confirmation_email_claimed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "confirmation_email_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "confirmation_email_message_id" varchar(255);--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "confirmation_email_last_error" text;--> statement-breakpoint
CREATE INDEX "ai_tutor_passes_email_queue_idx" ON "ai_tutor_passes" USING btree ("confirmation_email_status","confirmation_email_next_attempt_at");