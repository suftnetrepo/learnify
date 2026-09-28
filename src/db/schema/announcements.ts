import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { courses } from "./courses";

// Course-wide notices from a tutor (or admin) to every enrolled student.
export const announcements = pgTable(
  "announcements",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    courseId:  uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    tutorId:   uuid("tutor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tutorName: varchar("tutor_name", { length: 200 }).notNull(),   // snapshot at send time
    content:   text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("announcements_course_created_idx").on(table.courseId, table.createdAt),
  ]
);

export const announcementsRelations = relations(announcements, ({ one }) => ({
  course: one(courses, { fields: [announcements.courseId], references: [courses.id] }),
  tutor:  one(users,   { fields: [announcements.tutorId],  references: [users.id] }),
}));

export type Announcement    = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;
