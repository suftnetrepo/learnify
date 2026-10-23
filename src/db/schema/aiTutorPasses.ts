import { pgTable, uuid, varchar, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { aiPassPaymentStatusEnum, aiPassRevokeStatusEnum } from "./enums";
import { users } from "./users";

// ─── AI Tutor Pass ────────────────────────────────────────────────────────────
// One row per one-time purchase. The row id is the pass_id sent to StudyMind, which
// enforces the daily allowances and cost budget. Passes run back to back: a repurchase
// starts when the student's latest pass ends, so it never resets an active pass's limits.
// Periods use timestamptz — they are compared with StudyMind's expiry to the second.
export const aiTutorPasses = pgTable(
  "ai_tutor_passes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    // Stripe — unique ids make fulfilment and refund/dispute handling idempotent
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }).notNull().unique(),
    stripePaymentIntentId:   varchar("stripe_payment_intent_id",   { length: 255 }).unique(),
    stripePriceId:           varchar("stripe_price_id",            { length: 255 }).notNull(),
    stripeEventId:           varchar("stripe_event_id",            { length: 255 }),
    fulfilledVia:            varchar("fulfilled_via",              { length: 16 }).notNull(), // webhook | confirm
    amountPence:             integer("amount_pence").notNull(),
    currency:                varchar("currency", { length: 3 }).notNull(),
    consentAt:               timestamp("consent_at", { withTimezone: true }),   // UK digital-content consent

    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull(),
    startsAt:    timestamp("starts_at",    { withTimezone: true }).notNull(),
    endsAt:      timestamp("ends_at",      { withTimezone: true }).notNull(),

    // Payment + revocation (a revoked pass is never re-activated)
    paymentStatus:       aiPassPaymentStatusEnum("payment_status").default("paid").notNull(),
    revokedAt:           timestamp("revoked_at", { withTimezone: true }),
    revokeReason:        varchar("revoke_reason", { length: 64 }),
    refundedAmountPence: integer("refunded_amount_pence").default(0).notNull(),
    disputeId:           varchar("dispute_id", { length: 255 }),
    disputeStatus:       varchar("dispute_status", { length: 64 }),

    // StudyMind policy lifecycle
    studymindPolicyCreatedAt:     timestamp("studymind_policy_created_at",      { withTimezone: true }),
    studymindRevokeStatus:        aiPassRevokeStatusEnum("studymind_revoke_status").default("not_needed").notNull(),
    studymindRevokeAttempts:      integer("studymind_revoke_attempts").default(0).notNull(),
    studymindRevokeLastError:     text("studymind_revoke_last_error"),
    studymindRevokeNextAttemptAt: timestamp("studymind_revoke_next_attempt_at", { withTimezone: true }),
    studymindRevokedAt:           timestamp("studymind_revoked_at",             { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ai_tutor_passes_student_period_idx").on(table.studentId, table.endsAt),
    index("ai_tutor_passes_revoke_queue_idx").on(table.studymindRevokeStatus, table.studymindRevokeNextAttemptAt),
  ]
);

export const aiTutorPassesRelations = relations(aiTutorPasses, ({ one }) => ({
  student: one(users, { fields: [aiTutorPasses.studentId], references: [users.id] }),
}));

export type AiTutorPass = typeof aiTutorPasses.$inferSelect;
