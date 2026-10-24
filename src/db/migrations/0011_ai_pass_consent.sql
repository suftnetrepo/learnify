ALTER TABLE "ai_pass_checkouts" ADD COLUMN "terms_version" varchar(32);--> statement-breakpoint
ALTER TABLE "ai_pass_checkouts" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_pass_checkouts" ADD COLUMN "immediate_access_ack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "terms_version" varchar(32);--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "immediate_access_ack" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD COLUMN "confirmation_email_sent_at" timestamp with time zone;