import { index, pgTable, primaryKey, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { courses } from "./courses";

// Staff channel: a course's assigned tutors and the admins. Students never see it.
export const staffMessages = pgTable(
  "staff_messages",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    courseId:   uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    senderId:   uuid("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    senderName: varchar("sender_name", { length: 200 }).notNull(),   // snapshot at send time
    senderRole: text("sender_role").notNull().$type<"tutor" | "admin">(),
    content:    text("content").notNull(),
    createdAt:  timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("staff_messages_course_created_idx").on(table.courseId, table.createdAt),
  ]
);

// How far each staff member has read a course's staff channel — unread badges on any device.
export const staffChannelReads = pgTable(
  "staff_channel_reads",
  {
    courseId:   uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.userId] })]
);

export const staffMessagesRelations = relations(staffMessages, ({ one }) => ({
  course: one(courses, { fields: [staffMessages.courseId], references: [courses.id] }),
  sender: one(users,   { fields: [staffMessages.senderId], references: [users.id] }),
}));

export type StaffMessage    = typeof staffMessages.$inferSelect;
export type NewStaffMessage = typeof staffMessages.$inferInsert;
