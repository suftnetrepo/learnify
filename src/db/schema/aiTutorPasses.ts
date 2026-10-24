import { pgTable, uuid, varchar, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { aiPassPaymentStatusEnum, aiPassRevokeStatusEnum, aiPassCheckoutStatusEnum, aiPassRefundStatusEnum } from "./enums";
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
    // Purchase consent, copied from the checkout record: terms version accepted and the optional
    // request for immediate access (statutory cancellation rights are never removed without it)
    consentAt:               timestamp("consent_at", { withTimezone: true }),
    termsVersion:            varchar("terms_version", { length: 32 }),
    immediateAccessAck:      boolean("immediate_access_ack").default(false).notNull(),

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

    // Purchase confirmation email — claimed once, so duplicate webhooks/confirmations never resend
    confirmationEmailSentAt:      timestamp("confirmation_email_sent_at",       { withTimezone: true }),

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

// ─── AI Tutor Pass checkouts ──────────────────────────────────────────────────
// One row per Checkout Session Learnify starts. While "open" it reserves a pass slot (at most one
// active + two queued passes, counting checkouts that may still be paid). A paid session that
// cannot become a pass (limit reached, refunded/disputed before fulfilment, invalid) is kept here
// as "rejected" with the refund it is owed — a successful payment is never silently dropped.
// A refund or dispute that arrives before fulfilment is recorded here too (reversal), so a later
// fulfilment attempt can never grant the pass.
export const aiPassCheckouts = pgTable(
  "ai_pass_checkouts",
  {
    stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }).primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status:                aiPassCheckoutStatusEnum("status").default("open").notNull(),
    expiresAt:             timestamp("expires_at", { withTimezone: true }).notNull(),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }).unique(),
    passId:                uuid("pass_id").references(() => aiTutorPasses.id, { onDelete: "restrict" }),
    amountPence:           integer("amount_pence"),

    // Consent given when the checkout was started (server-recorded; the source for the pass)
    termsVersion:          varchar("terms_version", { length: 32 }),
    consentAt:             timestamp("consent_at", { withTimezone: true }),
    immediateAccessAck:    boolean("immediate_access_ack").default(false).notNull(),

    // Paid but not granted: queue_full | refunded | disputed | invalid
    rejectReason: varchar("reject_reason", { length: 32 }),
    rejectDetail: text("reject_detail"),

    // Refund / dispute seen before the pass existed (refunded | disputed)
    reversal:            varchar("reversal", { length: 16 }),
    reversedAt:          timestamp("reversed_at", { withTimezone: true }),
    refundedAmountPence: integer("refunded_amount_pence").default(0).notNull(),
    disputeStatus:       varchar("dispute_status", { length: 64 }),

    // Refund owed for a rejected payment (issued automatically, retried; invalid ones need review)
    refundStatus:        aiPassRefundStatusEnum("refund_status").default("not_required").notNull(),
    refundAttempts:      integer("refund_attempts").default(0).notNull(),
    refundLastError:     text("refund_last_error"),
    refundNextAttemptAt: timestamp("refund_next_attempt_at", { withTimezone: true }),
    stripeRefundId:      varchar("stripe_refund_id", { length: 255 }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ai_pass_checkouts_student_status_idx").on(table.studentId, table.status, table.expiresAt),
    index("ai_pass_checkouts_refund_queue_idx").on(table.refundStatus, table.refundNextAttemptAt),
  ]
);

export type AiPassCheckout = typeof aiPassCheckouts.$inferSelect;
