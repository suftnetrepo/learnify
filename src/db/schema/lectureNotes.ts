import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { lectures } from "./courseSections";

export const lectureNotes = pgTable("lecture_notes", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lectureId:  uuid("lecture_id").notNull().references(() => lectures.id, { onDelete: "cascade" }),
  content:    text("content").notNull().default(""),
  updatedAt:  timestamp("updated_at").notNull().defaultNow(),
});

export const lectureNotesRelations = relations(lectureNotes, ({ one }) => ({
  user:    one(users,    { fields: [lectureNotes.userId],    references: [users.id] }),
  lecture: one(lectures, { fields: [lectureNotes.lectureId], references: [lectures.id] }),
}));

export type LectureNote    = typeof lectureNotes.$inferSelect;
export type NewLectureNote = typeof lectureNotes.$inferInsert;
