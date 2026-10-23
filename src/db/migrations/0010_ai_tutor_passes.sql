CREATE TYPE "public"."ai_pass_payment_status" AS ENUM('paid', 'partially_refunded', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."ai_pass_revoke_status" AS ENUM('not_needed', 'pending', 'done');--> statement-breakpoint
CREATE TABLE "ai_tutor_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"stripe_checkout_session_id" varchar(255) NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_price_id" varchar(255) NOT NULL,
	"stripe_event_id" varchar(255),
	"fulfilled_via" varchar(16) NOT NULL,
	"amount_pence" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"consent_at" timestamp with time zone,
	"purchased_at" timestamp with time zone NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"payment_status" "ai_pass_payment_status" DEFAULT 'paid' NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoke_reason" varchar(64),
	"refunded_amount_pence" integer DEFAULT 0 NOT NULL,
	"dispute_id" varchar(255),
	"dispute_status" varchar(64),
	"studymind_policy_created_at" timestamp with time zone,
	"studymind_revoke_status" "ai_pass_revoke_status" DEFAULT 'not_needed' NOT NULL,
	"studymind_revoke_attempts" integer DEFAULT 0 NOT NULL,
	"studymind_revoke_last_error" text,
	"studymind_revoke_next_attempt_at" timestamp with time zone,
	"studymind_revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_tutor_passes_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "ai_tutor_passes_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
ALTER TABLE "ai_tutor_passes" ADD CONSTRAINT "ai_tutor_passes_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_tutor_passes_student_period_idx" ON "ai_tutor_passes" USING btree ("student_id","ends_at");--> statement-breakpoint
CREATE INDEX "ai_tutor_passes_revoke_queue_idx" ON "ai_tutor_passes" USING btree ("studymind_revoke_status","studymind_revoke_next_attempt_at");