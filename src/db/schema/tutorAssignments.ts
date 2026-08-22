import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { assignmentStatusEnum, tutorAccessLevelEnum } from "./enums";
import { users } from "./users";
import { courses } from "./courses";

// ─── Tutor Assignments ────────────────────────────────────────────────────────
export const tutorAssignments = pgTable(
  "tutor_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    tutorId: uuid("tutor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
    startDate: timestamp("start_date").notNull(),
    endDate: timestamp("end_date").notNull(),
    status: assignmentStatusEnum("status").default("active").notNull(),
    accessLevel: tutorAccessLevelEnum("access_level").notNull().default("viewer"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // A tutor can only have one active assignment per course
    uniqueIndex("tutor_assignment_unique_active_idx").on(
      table.courseId,
      table.tutorId
    ),
    index("tutor_assignments_tutor_idx").on(table.tutorId),
    index("tutor_assignments_course_idx").on(table.courseId),
    index("tutor_assignments_status_idx").on(table.status),
  ]
);

export const tutorAssignmentsRelations = relations(
  tutorAssignments,
  ({ one }) => ({
    course: one(courses, {
      fields: [tutorAssignments.courseId],
      references: [courses.id],
    }),
    tutor: one(users, {
      fields: [tutorAssignments.tutorId],
      references: [users.id],
      relationName: "tutor",
    }),
    assignedByUser: one(users, {
      fields: [tutorAssignments.assignedBy],
      references: [users.id],
      relationName: "assignedBy",
    }),
  })
);

export type TutorAssignment = typeof tutorAssignments.$inferSelect;
export type NewTutorAssignment = typeof tutorAssignments.$inferInsert;
