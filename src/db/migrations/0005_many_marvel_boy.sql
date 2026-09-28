CREATE TABLE "direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"sender_name" varchar(200) NOT NULL,
	"sender_role" text NOT NULL,
	"content" text NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direct_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"tutor_unread" integer DEFAULT 0 NOT NULL,
	"admin_unread" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_thread_id_direct_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."direct_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_threads" ADD CONSTRAINT "direct_threads_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "direct_messages_thread_created_idx" ON "direct_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_threads_tutor_idx" ON "direct_threads" USING btree ("tutor_id");--> statement-breakpoint
CREATE INDEX "direct_threads_last_message_idx" ON "direct_threads" USING btree ("last_message_at");