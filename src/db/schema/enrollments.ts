import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { courses } from "./courses";
import { purchases } from "./purchases";
import { courseSessions } from "./courseSessions";

// ─── Enrollments ──────────────────────────────────────────────────────────────
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    purchaseId: uuid("purchase_id").references(() => purchases.id, {
      onDelete: "set null",
    }),
    // Session booked (null for self-paced online courses)
    sessionId: uuid("session_id").references(() => courseSessions.id, {
      onDelete: "set null",
    }),
    // Progress: 0–100 percentage
    progress: integer("progress").default(0).notNull(),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    // Certificate
    certificateUrl: text("certificate_url"),
    certificateIssuedAt: timestamp("certificate_issued_at"),
  },
  (table) => [
    // One enrollment per student per course
    uniqueIndex("enrollments_student_course_idx").on(
      table.studentId,
      table.courseId
    ),
    index("enrollments_student_idx").on(table.studentId),
    index("enrollments_course_idx").on(table.courseId),
  ]
);

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(users, {
    fields: [enrollments.studentId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
  purchase: one(purchases, {
    fields: [enrollments.purchaseId],
    references: [purchases.id],
  }),
  session: one(courseSessions, {
    fields: [enrollments.sessionId],
    references: [courseSessions.id],
  }),
}));

export type Enrollment = typeof enrollments.$inferSelect;
export type NewEnrollment = typeof enrollments.$inferInsert;
