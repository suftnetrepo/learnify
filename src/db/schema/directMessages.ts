import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

/**
 * Direct chat between one tutor and the admin team (not tied to a course). One thread per
 * tutor; every admin can read and reply, and either side can start it.
 */
export const directThreads = pgTable(
  "direct_threads",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    tutorId:       uuid("tutor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt:     timestamp("created_at").notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
    // Unread for each side — drives the badges (admins share theirs, like a team inbox)
    tutorUnread:   integer("tutor_unread").notNull().default(0),
    adminUnread:   integer("admin_unread").notNull().default(0),
  },
  (table) => [
    uniqueIndex("direct_threads_tutor_idx").on(table.tutorId),
    index("direct_threads_last_message_idx").on(table.lastMessageAt),
  ]
);

export const directMessages = pgTable(
  "direct_messages",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    threadId:   uuid("thread_id").notNull().references(() => directThreads.id, { onDelete: "cascade" }),
    senderId:   uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    senderName: varchar("sender_name", { length: 200 }).notNull(),   // snapshot at send time
    senderRole: text("sender_role").notNull().$type<"tutor" | "admin">(),
    content:    text("content").notNull(),
    readAt:     timestamp("read_at"),   // null = not yet read by the other side
    createdAt:  timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("direct_messages_thread_created_idx").on(table.threadId, table.createdAt),
  ]
);

export const directThreadsRelations = relations(directThreads, ({ one, many }) => ({
  tutor:    one(users, { fields: [directThreads.tutorId], references: [users.id] }),
  messages: many(directMessages),
}));

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  thread: one(directThreads, { fields: [directMessages.threadId], references: [directThreads.id] }),
  sender: one(users,         { fields: [directMessages.senderId], references: [users.id] }),
}));

export type DirectThread  = typeof directThreads.$inferSelect;
export type DirectMessage = typeof directMessages.$inferSelect;
