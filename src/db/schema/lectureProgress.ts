import {
  pgTable,
  uuid,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { lectures } from "./courseSections";

// ─── Lecture Progress ─────────────────────────────────────────────────────────
export const lectureProgress = pgTable(
  "lecture_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    // Playback position in seconds for resume functionality
    watchedSeconds: integer("watched_seconds").default(0).notNull(),
    isCompleted: boolean("is_completed").default(false).notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("lecture_progress_user_lecture_idx").on(
      table.userId,
      table.lectureId
    ),
    index("lecture_progress_user_idx").on(table.userId),
    index("lecture_progress_lecture_idx").on(table.lectureId),
  ]
);

export const lectureProgressRelations = relations(
  lectureProgress,
  ({ one }) => ({
    user: one(users, {
      fields: [lectureProgress.userId],
      references: [users.id],
    }),
    lecture: one(lectures, {
      fields: [lectureProgress.lectureId],
      references: [lectures.id],
    }),
  })
);

export type LectureProgress = typeof lectureProgress.$inferSelect;
export type NewLectureProgress = typeof lectureProgress.$inferInsert;
