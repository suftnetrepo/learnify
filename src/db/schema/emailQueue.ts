import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { emailQueueStatusEnum } from "./enums";

export const emailQueue = pgTable(
  "email_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    to: varchar("to", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }).notNull(),
    html: text("html").notNull(),
    text: text("text"),
    context: varchar("context", { length: 255 }),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    status: emailQueueStatusEnum("status").default("pending").notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [
    index("email_queue_status_idx").on(table.status),
    index("email_queue_created_at_idx").on(table.createdAt),
  ]
);

export type EmailQueueItem = typeof emailQueue.$inferSelect;
