import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  attendanceStatusEnum,
  candidateOutcomeEnum,
  certificateStatusEnum,
  certificateTypeEnum,
} from "./enums";
import { users } from "./users";
import { courses } from "./courses";
import { courseSessions } from "./courseSessions";
import { enrollments } from "./enrollments";

export const sessionAttendance = pgTable(
  "session_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().references(() => courseSessions.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: attendanceStatusEnum("status").notNull().default("not_reviewed"),
    outcome: candidateOutcomeEnum("outcome").notNull().default("pending"),
    notes: text("notes"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("session_attendance_session_enrollment_idx").on(table.sessionId, table.enrollmentId),
    index("session_attendance_student_idx").on(table.studentId),
  ]
);

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    verificationCode: varchar("verification_code", { length: 32 }).notNull(),
    enrollmentId: uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").references(() => courseSessions.id, { onDelete: "set null" }),
    studentId: uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    type: certificateTypeEnum("type").notNull(),
    status: certificateStatusEnum("status").notNull().default("active"),
    recipientName: varchar("recipient_name", { length: 100 }).notNull(),
    courseTitle: varchar("course_title", { length: 255 }).notNull(),
    sessionTitle: varchar("session_title", { length: 200 }),
    completionDate: timestamp("completion_date").notNull(),
    issuerName: varchar("issuer_name", { length: 100 }),
    notes: text("notes"),
    pdfUrl: text("pdf_url").notNull(),
    issuedBy: uuid("issued_by").references(() => users.id, { onDelete: "set null" }),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
    revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at"),
    revocationReason: text("revocation_reason"),
  },
  (table) => [
    uniqueIndex("certificates_verification_code_idx").on(table.verificationCode),
    index("certificates_enrollment_idx").on(table.enrollmentId),
    index("certificates_session_idx").on(table.sessionId),
    index("certificates_student_idx").on(table.studentId),
  ]
);

export type SessionAttendance = typeof sessionAttendance.$inferSelect;
export type Certificate = typeof certificates.$inferSelect;
