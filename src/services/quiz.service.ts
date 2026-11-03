import { db } from "@/db";
import {
  courseSections, enrollments, moduleQuizzes, quizAnswers, quizAttempts,
  quizOptions, quizQuestions, users,
} from "@/db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { CourseQuizReport, QuizSubmissionResult, StudentModuleQuiz } from "@/types";

export class QuizError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "QuizError";
  }
}

export class QuizService {
  static async getPublishedForStudent(sectionId: string, studentId: string): Promise<StudentModuleQuiz | null> {
    const [row] = await db
      .select({
        id: moduleQuizzes.id, sectionId: moduleQuizzes.sectionId, title: moduleQuizzes.title,
        instructions: moduleQuizzes.instructions, passMark: moduleQuizzes.passMark,
        courseId: courseSections.courseId,
      })
      .from(moduleQuizzes)
      .innerJoin(courseSections, eq(courseSections.id, moduleQuizzes.sectionId))
      .where(and(eq(moduleQuizzes.sectionId, sectionId), eq(moduleQuizzes.isPublished, true)))
      .limit(1);

    if (!row) return null;

    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, row.courseId), eq(enrollments.studentId, studentId)))
      .limit(1);
    if (!enrollment) throw new QuizError("You are not enrolled in this course", 403);

    const questionRows = await db
      .select({ id: quizQuestions.id, question: quizQuestions.question, sortOrder: quizQuestions.sortOrder })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, row.id))
      .orderBy(asc(quizQuestions.sortOrder));
    const questionIds = questionRows.map((q) => q.id);
    const optionRows = questionIds.length
      ? await db
          .select({ id: quizOptions.id, questionId: quizOptions.questionId, label: quizOptions.label, sortOrder: quizOptions.sortOrder })
          .from(quizOptions)
          .where(inArray(quizOptions.questionId, questionIds))
          .orderBy(asc(quizOptions.sortOrder))
      : [];

    const attempts = await db
      .select({
        id: quizAttempts.id, score: quizAttempts.score, correctAnswers: quizAttempts.correctAnswers,
        totalQuestions: quizAttempts.totalQuestions, passed: quizAttempts.passed,
        submittedAt: quizAttempts.submittedAt,
      })
      .from(quizAttempts)
      .where(and(eq(quizAttempts.quizId, row.id), eq(quizAttempts.studentId, studentId)))
      .orderBy(desc(quizAttempts.submittedAt));

    return {
      id: row.id,
      sectionId: row.sectionId,
      title: row.title,
      instructions: row.instructions,
      passMark: row.passMark,
      questions: questionRows.map((q) => ({
        id: q.id,
        question: q.question,
        options: optionRows.filter((o) => o.questionId === q.id).map(({ id, label }) => ({ id, label })),
      })),
      latestAttempt: attempts[0] ?? null,
      bestScore: attempts.length ? Math.max(...attempts.map((a) => a.score)) : null,
    };
  }

  static async submit(
    quizId: string,
    studentId: string,
    submittedAnswers: Array<{ questionId: string; optionId: string }>,
  ): Promise<QuizSubmissionResult> {
    const [quiz] = await db
      .select({
        id: moduleQuizzes.id, passMark: moduleQuizzes.passMark,
        courseId: courseSections.courseId,
      })
      .from(moduleQuizzes)
      .innerJoin(courseSections, eq(courseSections.id, moduleQuizzes.sectionId))
      .where(and(eq(moduleQuizzes.id, quizId), eq(moduleQuizzes.isPublished, true)))
      .limit(1);
    if (!quiz) throw new QuizError("Quiz not found", 404);

    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.courseId, quiz.courseId), eq(enrollments.studentId, studentId)))
      .limit(1);
    if (!enrollment) throw new QuizError("You are not enrolled in this course", 403);

    const questions = await db
      .select({ id: quizQuestions.id, explanation: quizQuestions.explanation })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(asc(quizQuestions.sortOrder));
    if (!questions.length) throw new QuizError("This quiz has no questions yet");
    if (questions.length > 10) throw new QuizError("A module quiz cannot contain more than 10 questions");
    if (submittedAnswers.length !== questions.length) throw new QuizError("Answer every question before submitting");

    const uniqueQuestionIds = new Set(submittedAnswers.map((a) => a.questionId));
    if (uniqueQuestionIds.size !== questions.length || questions.some((q) => !uniqueQuestionIds.has(q.id))) {
      throw new QuizError("Invalid quiz answers");
    }

    const options = await db
      .select({ id: quizOptions.id, questionId: quizOptions.questionId, isCorrect: quizOptions.isCorrect })
      .from(quizOptions)
      .where(inArray(quizOptions.questionId, questions.map((q) => q.id)));
    const selectedByQuestion = new Map(submittedAnswers.map((a) => [a.questionId, a.optionId]));

    const marked = questions.map((question) => {
      const questionOptions = options.filter((o) => o.questionId === question.id);
      const selectedOptionId = selectedByQuestion.get(question.id)!;
      const selected = questionOptions.find((o) => o.id === selectedOptionId);
      const correct = questionOptions.filter((o) => o.isCorrect);
      if (!selected || correct.length !== 1) throw new QuizError("Quiz configuration is invalid");
      return {
        questionId: question.id,
        selectedOptionId,
        correctOptionId: correct[0].id,
        isCorrect: selected.isCorrect,
        explanation: question.explanation,
      };
    });

    const correctAnswers = marked.filter((a) => a.isCorrect).length;
    const score = Math.round((correctAnswers / questions.length) * 100);
    const passed = score >= quiz.passMark;

    return db.transaction(async (tx) => {
      const [attempt] = await tx
        .insert(quizAttempts)
        .values({
          quizId, studentId, enrollmentId: enrollment.id, score, correctAnswers,
          totalQuestions: questions.length, passed,
        })
        .returning();
      await tx.insert(quizAnswers).values(marked.map((answer) => ({
        attemptId: attempt.id,
        questionId: answer.questionId,
        optionId: answer.selectedOptionId,
        isCorrect: answer.isCorrect,
      })));
      return { ...attempt, answers: marked };
    });
  }

  static async getCourseReport(courseId: string): Promise<CourseQuizReport> {
    const sections = await db
      .select({ id: courseSections.id, title: courseSections.title })
      .from(courseSections)
      .where(eq(courseSections.courseId, courseId))
      .orderBy(asc(courseSections.sortOrder), asc(courseSections.createdAt));
    const sectionIds = sections.map((s) => s.id);
    const quizzes = sectionIds.length
      ? await db.select().from(moduleQuizzes).where(inArray(moduleQuizzes.sectionId, sectionIds))
      : [];
    const quizIds = quizzes.map((q) => q.id);
    const questions = quizIds.length
      ? await db.select({ id: quizQuestions.id, quizId: quizQuestions.quizId }).from(quizQuestions).where(inArray(quizQuestions.quizId, quizIds))
      : [];
    const students = await db
      .select({ studentId: enrollments.studentId, name: users.name, email: users.email })
      .from(enrollments)
      .innerJoin(users, eq(users.id, enrollments.studentId))
      .where(eq(enrollments.courseId, courseId))
      .orderBy(asc(users.name), asc(users.email));
    const attempts = quizIds.length
      ? await db.select().from(quizAttempts).where(inArray(quizAttempts.quizId, quizIds)).orderBy(desc(quizAttempts.submittedAt))
      : [];

    return {
      enrolledStudents: students.length,
      modules: sections.map((section) => {
        const quiz = quizzes.find((q) => q.sectionId === section.id) ?? null;
        const quizAttemptsRows = quiz ? attempts.filter((a) => a.quizId === quiz.id) : [];
        const studentRows = students.map((student) => {
          const own = quizAttemptsRows.filter((a) => a.studentId === student.studentId);
          const latest = own[0] ?? null;
          return {
            ...student,
            attempts: own.length,
            latestScore: latest?.score ?? null,
            bestScore: own.length ? Math.max(...own.map((a) => a.score)) : null,
            passed: latest?.passed ?? null,
            lastSubmittedAt: latest?.submittedAt ?? null,
          };
        });
        const attempted = studentRows.filter((s) => s.attempts > 0);
        return {
          sectionId: section.id,
          sectionTitle: section.title,
          quizId: quiz?.id ?? null,
          quizTitle: quiz?.title ?? null,
          isPublished: quiz?.isPublished ?? false,
          questionCount: quiz ? questions.filter((q) => q.quizId === quiz.id).length : 0,
          attemptedStudents: attempted.length,
          outstandingStudents: students.length - attempted.length,
          averageScore: attempted.length
            ? Math.round(attempted.reduce((sum, s) => sum + (s.latestScore ?? 0), 0) / attempted.length)
            : null,
          passedStudents: attempted.filter((s) => s.passed).length,
          students: studentRows,
        };
      }),
    };
  }
}
