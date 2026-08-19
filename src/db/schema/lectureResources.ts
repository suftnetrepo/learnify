import { pgTable, text, timestamp, integer, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { lectures } from "./courseSections";

export const lectureResourceTypes = ["pdf", "zip", "github", "link", "video"] as const;
export type LectureResourceType = typeof lectureResourceTypes[number];

export const lectureResources = pgTable("lecture_resources", {
  id:         uuid("id").primaryKey().defaultRandom(),
  lectureId:  uuid("lecture_id").notNull().references(() => lectures.id, { onDelete: "cascade" }),
  type:       text("type").notNull().$type<LectureResourceType>(),
  label:      text("label").notNull(),
  url:        text("url").notNull(),
  sortOrder:  integer("sort_order").notNull().default(0),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const lectureResourcesRelations = relations(lectureResources, ({ one }) => ({
  lecture: one(lectures, { fields: [lectureResources.lectureId], references: [lectures.id] }),
}));

export type LectureResource    = typeof lectureResources.$inferSelect;
export type NewLectureResource = typeof lectureResources.$inferInsert;
