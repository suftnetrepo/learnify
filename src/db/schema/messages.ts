import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { conversations } from "./conversations";

export const messages = pgTable(
  "messages",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId:       uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    senderRole:     text("sender_role").notNull().$type<"student" | "tutor" | "admin">(),
    content:        text("content").notNull(),
    readAt:         timestamp("read_at"),   // null = not yet read by the other side
    createdAt:      timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  ]
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender:       one(users,         { fields: [messages.senderId],       references: [users.id] }),
}));

export type Message    = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
