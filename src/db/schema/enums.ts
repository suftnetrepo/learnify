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
