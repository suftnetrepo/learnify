import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { courseStatusEnum, courseFormatEnum } from "./enums";
import { users } from "./users";
import { enrollments } from "./enrollments";
import { purchases } from "./purchases";
import { tutorAssignments } from "./tutorAssignments";
import { courseSections } from "./courseSections";
import { courseReviews } from "./courseReviews";

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    slug: varchar("slug", { length: 120 }).notNull().unique(),
    description: text("description"),
    iconUrl: text("icon_url"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("categories_slug_idx").on(table.slug),
  ]
);

export const categoriesRelations = relations(categories, ({ many }) => ({
  courses: many(courses),
}));

// ─── Courses ──────────────────────────────────────────────────────────────────
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 220 }).notNull().unique(),
    description: text("description"),
    shortDescription: varchar("short_description", { length: 500 }),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    format: courseFormatEnum("format").notNull(),
    location: varchar("location", { length: 255 }),  // Physical address for in_person
    status: courseStatusEnum("status").default("draft").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    previewVideoUrl: text("preview_video_url"),
    // Metadata
    totalDuration: integer("total_duration"),         // minutes
    totalLectures: integer("total_lectures").default(0),
    level: varchar("level", { length: 50 }),          // beginner, intermediate, advanced
    language: varchar("language", { length: 50 }).default("English"),
    requirements: text("requirements"),               // JSON array as text
    whatYouLearn: text("what_you_learn"),             // JSON array as text
    // Relations
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    // Stats (denormalised for performance)
    enrollmentCount: integer("enrollment_count").default(0),
    averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0"),
    reviewCount: integer("review_count").default(0),
    // Timestamps
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("courses_status_idx").on(table.status),
    index("courses_category_idx").on(table.categoryId),
    index("courses_created_by_idx").on(table.createdBy),
    index("courses_slug_idx").on(table.slug),
    index("courses_format_idx").on(table.format),
  ]
);

export const coursesRelations = relations(courses, ({ one, many }) => ({
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  creator: one(users, {
    fields: [courses.createdBy],
    references: [users.id],
  }),
  sections: many(courseSections),
  enrollments: many(enrollments),
  purchases: many(purchases),
  tutorAssignments: many(tutorAssignments),
  reviews: many(courseReviews),
}));

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
