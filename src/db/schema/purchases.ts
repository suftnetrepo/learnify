import {
  pgTable,
  uuid,
  decimal,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { purchaseStatusEnum } from "./enums";
import { users } from "./users";
import { courses } from "./courses";
import { enrollments } from "./enrollments";

// ─── Purchases ────────────────────────────────────────────────────────────────
export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    tutorId: uuid("tutor_id").references(() => users.id, { onDelete: "set null" }),
    // Financials (stored in pence/cents as decimal for accuracy)
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(),
    tutorAmount: decimal("tutor_amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("gbp").notNull(),
    // Stripe
    stripeSessionId: varchar("stripe_session_id", { length: 255 }).unique(),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeTransferId: varchar("stripe_transfer_id", { length: 255 }),
    // Idempotency – prevents double processing of webhooks
    stripeEventId: varchar("stripe_event_id", { length: 255 }).unique(),
    status: purchaseStatusEnum("status").default("pending").notNull(),
    refundedAt: timestamp("refunded_at"),
    refundReason: text("refund_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("purchases_student_idx").on(table.studentId),
    index("purchases_course_idx").on(table.courseId),
    index("purchases_tutor_idx").on(table.tutorId),
    index("purchases_status_idx").on(table.status),
    index("purchases_stripe_session_idx").on(table.stripeSessionId),
    index("purchases_stripe_event_idx").on(table.stripeEventId),
  ]
);

export const purchasesRelations = relations(purchases, ({ one, many }) => ({
  student: one(users, {
    fields: [purchases.studentId],
    references: [users.id],
    relationName: "student",
  }),
  course: one(courses, {
    fields: [purchases.courseId],
    references: [courses.id],
  }),
  tutor: one(users, {
    fields: [purchases.tutorId],
    references: [users.id],
    relationName: "tutor",
  }),
  enrollments: many(enrollments),
}));

export type Purchase = typeof purchases.$inferSelect;
export type NewPurchase = typeof purchases.$inferInsert;
