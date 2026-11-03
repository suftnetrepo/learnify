import {
  pgTable, uuid, varchar, text, integer, boolean, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { courseSections } from "./courseSections";
import { users } from "./users";
import { enrollments } from "./enrollments";

/** One end-of-module exercise for each curriculum section. */
export const moduleQuizzes = pgTable("module_quizzes", {
  id:           uuid("id").primaryKey().defaultRandom(),
  sectionId:    uuid("section_id").notNull().references(() => courseSections.id, { onDelete: "cascade" }),
  title:        varchar("title", { length: 200 }).notNull(),
  instructions: text("instructions"),
  sourceDocument: varchar("source_document", { length: 255 }),
  sourceReference: varchar("source_reference", { length: 255 }),
  passMark:     integer("pass_mark").notNull().default(70),
  isPublished:  boolean("is_published").notNull().default(false),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
  updatedAt:    timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("module_quizzes_section_unique_idx").on(table.sectionId),
]);

export const quizQuestions = pgTable("quiz_questions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  quizId:      uuid("quiz_id").notNull().references(() => moduleQuizzes.id, { onDelete: "cascade" }),
  question:    text("question").notNull(),
  explanation: text("explanation"),
  sortOrder:   integer("sort_order").notNull().default(0),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("quiz_questions_quiz_idx").on(table.quizId),
  uniqueIndex("quiz_questions_order_unique_idx").on(table.quizId, table.sortOrder),
]);

export const quizOptions = pgTable("quiz_options", {
  id:        uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  label:     text("label").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  index("quiz_options_question_idx").on(table.questionId),
  uniqueIndex("quiz_options_order_unique_idx").on(table.questionId, table.sortOrder),
]);

export const quizAttempts = pgTable("quiz_attempts", {
  id:             uuid("id").primaryKey().defaultRandom(),
  quizId:         uuid("quiz_id").notNull().references(() => moduleQuizzes.id, { onDelete: "cascade" }),
  studentId:      uuid("student_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  enrollmentId:   uuid("enrollment_id").notNull().references(() => enrollments.id, { onDelete: "cascade" }),
  score:          integer("score").notNull(),
  correctAnswers: integer("correct_answers").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  passed:         boolean("passed").notNull(),
  submittedAt:    timestamp("submitted_at").notNull().defaultNow(),
}, (table) => [
  index("quiz_attempts_quiz_idx").on(table.quizId),
  index("quiz_attempts_student_idx").on(table.studentId),
  index("quiz_attempts_quiz_student_idx").on(table.quizId, table.studentId),
]);

export const quizAnswers = pgTable("quiz_answers", {
  id:         uuid("id").primaryKey().defaultRandom(),
  attemptId:  uuid("attempt_id").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  optionId:   uuid("option_id").notNull().references(() => quizOptions.id, { onDelete: "restrict" }),
  isCorrect:  boolean("is_correct").notNull(),
}, (table) => [
  uniqueIndex("quiz_answers_attempt_question_unique_idx").on(table.attemptId, table.questionId),
  index("quiz_answers_attempt_idx").on(table.attemptId),
]);

export const moduleQuizzesRelations = relations(moduleQuizzes, ({ one, many }) => ({
  section:   one(courseSections, { fields: [moduleQuizzes.sectionId], references: [courseSections.id] }),
  questions: many(quizQuestions),
  attempts:  many(quizAttempts),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one, many }) => ({
  quiz:    one(moduleQuizzes, { fields: [quizQuestions.quizId], references: [moduleQuizzes.id] }),
  options: many(quizOptions),
  answers: many(quizAnswers),
}));

export const quizOptionsRelations = relations(quizOptions, ({ one, many }) => ({
  question: one(quizQuestions, { fields: [quizOptions.questionId], references: [quizQuestions.id] }),
  answers:  many(quizAnswers),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  quiz:       one(moduleQuizzes, { fields: [quizAttempts.quizId], references: [moduleQuizzes.id] }),
  student:    one(users, { fields: [quizAttempts.studentId], references: [users.id] }),
  enrollment: one(enrollments, { fields: [quizAttempts.enrollmentId], references: [enrollments.id] }),
  answers:    many(quizAnswers),
}));

export const quizAnswersRelations = relations(quizAnswers, ({ one }) => ({
  attempt:  one(quizAttempts, { fields: [quizAnswers.attemptId], references: [quizAttempts.id] }),
  question: one(quizQuestions, { fields: [quizAnswers.questionId], references: [quizQuestions.id] }),
  option:   one(quizOptions, { fields: [quizAnswers.optionId], references: [quizOptions.id] }),
}));
