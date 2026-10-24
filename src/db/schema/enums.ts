import { pgEnum } from "drizzle-orm/pg-core";

// ─── User ─────────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", [
  "student",
  "tutor",
  "admin",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "pending",      // tutor awaiting admin approval
  "suspended",
  "invited",      // invitation sent, not yet registered
]);

// ─── Course ───────────────────────────────────────────────────────────────────
export const courseStatusEnum = pgEnum("course_status", [
  "draft",
  "pending_review", // submitted by a manager-level tutor, awaiting admin approval
  "published",
  "archived",
]);

export const courseFormatEnum = pgEnum("course_format", [
  "online",
  "in_person",
  "hybrid",
]);

// ─── Tutor Assignment ─────────────────────────────────────────────────────────
export const assignmentStatusEnum = pgEnum("assignment_status", [
  "active",
  "completed",
  "cancelled",
]);

// Per-assignment capability level — scopes what a tutor can do on that one
// course. "editor" unlocks the instructor-facing course editor (content only).
// "manager" additionally allows creating courses and setting pricing, but a
// manager-created/edited course still needs admin approval before it publishes.
export const tutorAccessLevelEnum = pgEnum("tutor_access_level", [
  "viewer",
  "editor",
  "manager",
]);

// ─── Purchase ─────────────────────────────────────────────────────────────────
export const purchaseStatusEnum = pgEnum("purchase_status", [
  "pending",
  "completed",
  "refunded",
  "failed",
]);

// ─── Invitation ───────────────────────────────────────────────────────────────
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

// ─── Stripe Connect ───────────────────────────────────────────────────────────
export const stripeOnboardingStatusEnum = pgEnum("stripe_onboarding_status", [
  "not_started",
  "in_progress",
  "complete",
  "restricted",
]);

// ─── Course Session ───────────────────────────────────────────────────────────
export const sessionStatusEnum = pgEnum("session_status", [
  "scheduled",
  "cancelled",
  "completed",
]);

export const conferencePlatformEnum = pgEnum("conference_platform", [
  "zoom",
  "teams",
  "google_meet",
  "webex",
  "other",
]);

// ─── Email delivery ──────────────────────────────────────────────────────────
export const emailQueueStatusEnum = pgEnum("email_queue_status", [
  "pending",
  "sent",
  "failed",
]);

// ─── AI Tutor Pass ────────────────────────────────────────────────────────────
export const aiPassPaymentStatusEnum = pgEnum("ai_pass_payment_status", [
  "paid",
  "partially_refunded",
  "refunded",
  "disputed",
]);

// Whether a revoked pass's StudyMind policy still needs revoking (retried until "done")
export const aiPassRevokeStatusEnum = pgEnum("ai_pass_revoke_status", [
  "not_needed",
  "pending",
  "done",
]);

// A Checkout Session started for a pass: the reservation that enforces the pass limit, and the
// durable record of a payment that could not be turned into a pass
export const aiPassCheckoutStatusEnum = pgEnum("ai_pass_checkout_status", [
  "open",
  "expired",
  "fulfilled",
  "rejected",
]);

// Refund owed for a rejected (paid but unfulfillable) checkout
export const aiPassRefundStatusEnum = pgEnum("ai_pass_refund_status", [
  "not_required",
  "required",
  "refunded",
  "manual_review",
]);

// AI Tutor Pass purchase confirmation email (an outbox on the pass row)
export const aiPassEmailStatusEnum = pgEnum("ai_pass_email_status", [
  "not_required",
  "pending",
  "sending",
  "sent",
  "failed",
  "skipped",
]);
