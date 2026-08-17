import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sessionStatusEnum, conferencePlatformEnum } from "./enums";
import { courses } from "./courses";
import { users } from "./users";
import { enrollments } from "./enrollments";

// ─── Course Sessions ──────────────────────────────────────────────────────────
// One course can have many sessions (e.g. morning cohort, evening batch).
// For online-live courses: conference details are populated.
// For in-person / hybrid: venue details are populated.
// Sessions are what students book at checkout (not just the course).

export const courseSessions = pgTable(
  "course_sessions",
  {
    id:       uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),

    // Display
    title:       varchar("title",       { length: 200 }).notNull(),
    description: text("description"),

    // Timing
    startDatetime: timestamp("start_datetime", { withTimezone: true }).notNull(),
    endDatetime:   timestamp("end_datetime",   { withTimezone: true }).notNull(),

    // Capacity
    capacity:      integer("capacity").notNull().default(20),     // max seats
    enrolledCount: integer("enrolled_count").notNull().default(0), // denormalised

    // In-person / hybrid venue
    venueAddress:  varchar("venue_address",  { length: 500 }),
    venueCity:     varchar("venue_city",     { length: 100 }),
    venuePostcode: varchar("venue_postcode", { length: 20  }),
    venueMapUrl:   text("venue_map_url"),                          // Google Maps URL

    // Online-live conference
    conferencePlatform: conferencePlatformEnum("conference_platform"),
    conferenceUrl:      text("conference_url"),      // join link — only shown to enrolled students
    conferencePassword: varchar("conference_password", { length: 100 }),

    // Status
    status: sessionStatusEnum("session_status").notNull().default("scheduled"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("sessions_course_idx").on(table.courseId),
    index("sessions_start_idx").on(table.startDatetime),
    index("sessions_status_idx").on(table.status),
  ]
);

export const courseSessionsRelations = relations(courseSessions, ({ one, many }) => ({
  course:    one(courses,    { fields: [courseSessions.courseId], references: [courses.id] }),
  waitlist:  many(courseSessionWaitlist),
  enrollmentLinks: many(enrollments),
}));

// ─── Session Waitlist ─────────────────────────────────────────────────────────
// When a session is full, students join the waitlist.
// Position is maintained for fair ordering.

export const courseSessionWaitlist = pgTable(
  "course_session_waitlist",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => courseSessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position:  integer("position").notNull(),
    joinedAt:  timestamp("joined_at").defaultNow().notNull(),
    notifiedAt: timestamp("notified_at"),          // when we told them a seat opened
  },
  (table) => [
    uniqueIndex("waitlist_session_student_idx").on(table.sessionId, table.studentId),
    index("waitlist_session_idx").on(table.sessionId),
    index("waitlist_position_idx").on(table.sessionId, table.position),
  ]
);

export const courseSessionWaitlistRelations = relations(courseSessionWaitlist, ({ one }) => ({
  session: one(courseSessions, { fields: [courseSessionWaitlist.sessionId], references: [courseSessions.id] }),
  student: one(users,          { fields: [courseSessionWaitlist.studentId], references: [users.id] }),
}));

export type CourseSession    = typeof courseSessions.$inferSelect;
export type NewCourseSession = typeof courseSessions.$inferInsert;
export type WaitlistEntry    = typeof courseSessionWaitlist.$inferSelect;
