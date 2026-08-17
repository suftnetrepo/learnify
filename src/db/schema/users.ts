import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  userRoleEnum,
  userStatusEnum,
  stripeOnboardingStatusEnum,
} from "./enums";
import { enrollments } from "./enrollments";
import { purchases } from "./purchases";
import { tutorAssignments } from "./tutorAssignments";
import { courseReviews } from "./courseReviews";
import { tutorInvitations } from "./tutorInvitations";
import { courses } from "./courses";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 100 }),
    passwordHash: text("password_hash"), // NULL for OAuth
    role: userRoleEnum("role").default("student").notNull(),
    status: userStatusEnum("status").default("active").notNull(),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    emailVerificationToken: text("email_verification_token"),
    emailVerificationExpires: timestamp("email_verification_expires"),
    passwordResetToken: text("password_reset_token"),
    passwordResetExpires: timestamp("password_reset_expires"),
    // Stripe Connect (tutors only)
    stripeAccountId: varchar("stripe_account_id", { length: 255 }),
    stripeOnboardingStatus: stripeOnboardingStatusEnum(
      "stripe_onboarding_status"
    ).default("not_started"),
    stripePayoutsEnabled: boolean("stripe_payouts_enabled").default(false),
    stripeChargesEnabled: boolean("stripe_charges_enabled").default(false),
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"), // soft delete
    lastLoginAt: timestamp("last_login_at"),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
    index("users_status_idx").on(table.status),
    index("users_deleted_at_idx").on(table.deletedAt),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  enrollments: many(enrollments),
  studentPurchases: many(purchases, { relationName: "student" }),
  tutorPurchases:   many(purchases, { relationName: "tutor" }),
  createdCourses: many(courses),
  tutorAssignments: many(tutorAssignments),
  reviews: many(courseReviews),
  sentInvitations: many(tutorInvitations, { relationName: "invitedBy" }),
  receivedInvitations: many(tutorInvitations, { relationName: "invitee" }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = "student" | "tutor" | "admin";
export type UserStatus = "active" | "pending" | "suspended" | "invited";
