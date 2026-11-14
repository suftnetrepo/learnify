CREATE TYPE "public"."attendance_status" AS ENUM('not_reviewed', 'attended', 'partial', 'absent');--> statement-breakpoint
CREATE TYPE "public"."candidate_outcome" AS ENUM('pending', 'passed', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."certificate_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."certificate_type" AS ENUM('attendance', 'completion');--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"verification_code" varchar(32) NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"session_id" uuid,
	"student_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"type" "certificate_type" NOT NULL,
	"status" "certificate_status" DEFAULT 'active' NOT NULL,
	"recipient_name" varchar(100) NOT NULL,
	"course_title" varchar(255) NOT NULL,
	"session_title" varchar(200),
	"completion_date" timestamp NOT NULL,
	"issuer_name" varchar(100),
	"notes" text,
	"pdf_url" text NOT NULL,
	"issued_by" uuid,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"revoked_by" uuid,
	"revoked_at" timestamp,
	"revocation_reason" text
);
--> statement-breakpoint
CREATE TABLE "session_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" "attendance_status" DEFAULT 'not_reviewed' NOT NULL,
	"outcome" "candidate_outcome" DEFAULT 'pending' NOT NULL,
	"notes" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_session_id_course_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."course_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_session_id_course_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."course_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_verification_code_idx" ON "certificates" USING btree ("verification_code");--> statement-breakpoint
CREATE INDEX "certificates_enrollment_idx" ON "certificates" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "certificates_session_idx" ON "certificates" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "certificates_student_idx" ON "certificates" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_attendance_session_enrollment_idx" ON "session_attendance" USING btree ("session_id","enrollment_id");--> statement-breakpoint
CREATE INDEX "session_attendance_student_idx" ON "session_attendance" USING btree ("student_id");