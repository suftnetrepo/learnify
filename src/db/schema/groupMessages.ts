import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { courses } from "./courses";
import { courseSessions } from "./courseSessions";

// Live Q&A: the whole class + tutors chatting during a live course session.
export const groupMessages = pgTable(
  "group_messages",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    courseId:   uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    sessionId:  uuid("session_id").references(() => courseSessions.id, { onDelete: "set null" }),
    senderId:   uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    senderName: varchar("sender_name", { length: 200 }).notNull(),   // snapshot at send time
    senderRole: text("sender_role").notNull().$type<"student" | "tutor" | "admin">(),
    content:    text("content").notNull(),
    createdAt:  timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("group_messages_course_session_created_idx").on(table.courseId, table.sessionId, table.createdAt),
  ]
);

export const groupMessagesRelations = relations(groupMessages, ({ one }) => ({
  course:  one(courses,        { fields: [groupMessages.courseId],  references: [courses.id] }),
  session: one(courseSessions, { fields: [groupMessages.sessionId], references: [courseSessions.id] }),
  sender:  one(users,          { fields: [groupMessages.senderId],  references: [users.id] }),
}));

export type GroupMessage    = typeof groupMessages.$inferSelect;
export type NewGroupMessage = typeof groupMessages.$inferInsert;
