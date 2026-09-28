import { index, integer, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { courses } from "./courses";
import { messages } from "./messages";

/**
 * One conversation per student per course (WhatsApp-style, asynchronous). Every tutor
 * assigned to the course shares it; admins can read it.
 */
export const conversations = pgTable(
  "conversations",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    courseId:      uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    studentId:     uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt:     timestamp("created_at").notNull().defaultNow(),
    lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
    // Unread messages for each side — drives the badges
    studentUnread: integer("student_unread").notNull().default(0),
    tutorUnread:   integer("tutor_unread").notNull().default(0),
  },
  (table) => [
    uniqueIndex("conversations_course_student_idx").on(table.courseId, table.studentId),
    index("conversations_last_message_idx").on(table.lastMessageAt),
  ]
);

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  course:   one(courses, { fields: [conversations.courseId],  references: [courses.id] }),
  student:  one(users,   { fields: [conversations.studentId], references: [users.id] }),
  messages: many(messages),
}));

export type Conversation    = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
