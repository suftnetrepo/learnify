/**
 * Draft-first module quiz importer.
 *
 * Usage:
 *   npx tsx scripts/import-module-quizzes.ts content/quizzes/business-analysis.json
 *   npx tsx scripts/import-module-quizzes.ts content/quizzes/business-analysis.json --apply
 *
 * Importing never publishes quizzes. Publication will be added as a separate,
 * deliberate release step after content and UI review.
 */
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

config({ path: ".env.local", quiet: true });

const optionSchema = z.object({ label: z.string().min(1), correct: z.boolean() });
const questionSchema = z.object({
  question: z.string().min(1),
  explanation: z.string().min(1).optional(),
  options: z.array(optionSchema).min(2).max(6).refine(
    (options) => options.filter((option) => option.correct).length === 1,
    "Each question must have exactly one correct option",
  ),
});
const seedSchema = z.object({
  courseTitle: z.string().min(1),
  sourceDocument: z.string().min(1),
  modules: z.array(z.object({
    sortOrder: z.number().int().min(1),
    sourceReference: z.string().min(1),
    title: z.string().min(1).optional(),
    instructions: z.string().min(1).optional(),
    passMark: z.number().int().min(1).max(100).default(70),
    questions: z.array(questionSchema).min(1).max(10),
  })).min(1),
});

async function main() {
  const input = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!input) throw new Error("Provide a quiz seed JSON file");

  const seed = seedSchema.parse(JSON.parse(await readFile(resolve(input), "utf8")));
  const { db } = await import("@/db");
  const {
    courses, courseSections, moduleQuizzes, quizAttempts, quizQuestions, quizOptions,
  } = await import("@/db/schema");
  const { and, asc, eq, inArray } = await import("drizzle-orm");

  const [course] = await db.select({ id: courses.id, title: courses.title })
    .from(courses).where(eq(courses.title, seed.courseTitle)).limit(1);
  if (!course) throw new Error(`Course not found: ${seed.courseTitle}`);

  const sections = await db.select({ id: courseSections.id, title: courseSections.title, sortOrder: courseSections.sortOrder })
    .from(courseSections).where(eq(courseSections.courseId, course.id)).orderBy(asc(courseSections.sortOrder));
  const mapped = seed.modules.map((module) => {
    const section = sections.find((row) => row.sortOrder === module.sortOrder);
    if (!section) throw new Error(`Module ${module.sortOrder} does not exist in ${seed.courseTitle}`);
    return { module, section };
  });

  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${seed.courseTitle}`);
  for (const { module, section } of mapped) {
    console.log(`  ${module.sortOrder}. ${section.title}: ${module.questions.length} questions (${module.sourceReference})`);
  }
  if (!apply) {
    console.log("No database changes made. Add --apply after reviewing this mapping.");
    return;
  }

  await db.transaction(async (tx) => {
    for (const { module, section } of mapped) {
      let [quiz] = await tx.select({ id: moduleQuizzes.id }).from(moduleQuizzes)
        .where(eq(moduleQuizzes.sectionId, section.id)).limit(1);
      if (!quiz) {
        [quiz] = await tx.insert(moduleQuizzes).values({
          sectionId: section.id,
          title: module.title ?? `${section.title} Exercise`,
          instructions: module.instructions ?? "Answer every question, then submit to see your score.",
          passMark: module.passMark,
          sourceDocument: seed.sourceDocument,
          sourceReference: module.sourceReference,
          isPublished: false,
        }).returning({ id: moduleQuizzes.id });
      }

      const [attempt] = await tx.select({ id: quizAttempts.id }).from(quizAttempts)
        .where(eq(quizAttempts.quizId, quiz.id)).limit(1);
      if (attempt) throw new Error(`Refusing to replace ${section.title}: student attempts already exist`);

      const existingQuestions = await tx.select({ id: quizQuestions.id }).from(quizQuestions)
        .where(eq(quizQuestions.quizId, quiz.id));
      if (existingQuestions.length) {
        await tx.delete(quizOptions).where(inArray(quizOptions.questionId, existingQuestions.map((question) => question.id)));
        await tx.delete(quizQuestions).where(eq(quizQuestions.quizId, quiz.id));
      }

      await tx.update(moduleQuizzes).set({
        title: module.title ?? `${section.title} Exercise`,
        instructions: module.instructions ?? "Answer every question, then submit to see your score.",
        passMark: module.passMark,
        sourceDocument: seed.sourceDocument,
        sourceReference: module.sourceReference,
        isPublished: false,
        updatedAt: new Date(),
      }).where(and(eq(moduleQuizzes.id, quiz.id), eq(moduleQuizzes.sectionId, section.id)));

      for (const [questionIndex, question] of module.questions.entries()) {
        const [created] = await tx.insert(quizQuestions).values({
          quizId: quiz.id,
          question: question.question,
          explanation: question.explanation ?? null,
          sortOrder: questionIndex,
        }).returning({ id: quizQuestions.id });
        await tx.insert(quizOptions).values(question.options.map((option, optionIndex) => ({
          questionId: created.id,
          label: option.label,
          isCorrect: option.correct,
          sortOrder: optionIndex,
        })));
      }
    }
  });
  console.log("Draft quiz content imported successfully. Nothing was published.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
