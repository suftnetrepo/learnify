import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { courses } from "./courses";
import { lectureProgress } from "./lectureProgress";

// ─── Course Sections (Modules) ────────────────────────────────────────────────
export const courseSections = pgTable(
  "course_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sections_course_idx").on(table.courseId),
    index("sections_sort_idx").on(table.courseId, table.sortOrder),
  ]
);

export const courseSectionsRelations = relations(
  courseSections,
  ({ one, many }) => ({
    course: one(courses, {
      fields: [courseSections.courseId],
      references: [courses.id],
    }),
    lectures: many(lectures),
  })
);

// ─── Lectures ─────────────────────────────────────────────────────────────────
export const lectures = pgTable(
  "lectures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => courseSections.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    // Video
    videoUrl: text("video_url"),               // Cloudinary URL
    videoPublicId: text("video_public_id"),    // Cloudinary public ID for management
    videoDuration: integer("video_duration"),  // seconds
    thumbnailUrl: text("thumbnail_url"),
    // Resources
    resourceUrl: text("resource_url"),         // downloadable attachment
    resourceName: varchar("resource_name", { length: 200 }),
    // Access
    isFree: boolean("is_free").default(false).notNull(), // preview lecture
    isPublished: boolean("is_published").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("lectures_section_idx").on(table.sectionId),
    index("lectures_sort_idx").on(table.sectionId, table.sortOrder),
    index("lectures_published_idx").on(table.isPublished),
  ]
);

export const lecturesRelations = relations(lectures, ({ one, many }) => ({
  section: one(courseSections, {
    fields: [lectures.sectionId],
    references: [courseSections.id],
  }),
  progress: many(lectureProgress),
}));

export type CourseSection = typeof courseSections.$inferSelect;
export type NewCourseSection = typeof courseSections.$inferInsert;
export type Lecture = typeof lectures.$inferSelect;
export type NewLecture = typeof lectures.$inferInsert;
