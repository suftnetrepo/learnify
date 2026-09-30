/**
 * Idempotently imports the five candidate course booklets into the live database.
 *
 * Safety: this script only reads DATABASE_URL_LIVE. It never falls back to DATABASE_URL.
 * Run a local validation first with:
 *   npm run db:import:course-booklets:live -- --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import path from "node:path";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { v2 as cloudinary } from "cloudinary";
import * as schema from "./schema";
import courseBookletsJson from "./course-content/course-booklets.generated.json";

type LessonSource = {
  title: string;
  durationMinutes: number;
  isFree?: boolean;
  content: string;
};

type ModuleSource = {
  title: string;
  description: string;
  lessons: LessonSource[];
};

type CourseSource = {
  title: string;
  slug: string;
  category: { name: string; slug: string };
  shortDescription: string;
  description: string;
  sourceFilename: string;
  requirements: string[];
  whatYouLearn: string[];
  modules: ModuleSource[];
};

const sources = courseBookletsJson as CourseSource[];
const dryRun = process.argv.includes("--dry-run");
const liveUrl = process.env.DATABASE_URL_LIVE;

if (!liveUrl) {
  throw new Error("DATABASE_URL_LIVE is required; the importer will not fall back to DATABASE_URL.");
}

const requiredCloudinary = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

if (!dryRun) {
  const missing = requiredCloudinary.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing Cloudinary configuration: ${missing.join(", ")}`);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const client = postgres(liveUrl, { max: 1 });
const db = drizzle(client, { schema });
const venueAddress = "Royal Victoria Dock, 1 Western Gateway";
const venueCity = "London";
const venuePostcode = "E16 1XL";

const cohortTemplates = [
  {
    title: "October 2026 Intensive Cohort",
    startDatetime: new Date("2026-10-19T09:00:00+01:00"),
    endDatetime: new Date("2026-10-30T17:00:00+00:00"),
  },
  {
    title: "November 2026 Intensive Cohort",
    startDatetime: new Date("2026-11-19T09:00:00+00:00"),
    endDatetime: new Date("2026-11-30T17:00:00+00:00"),
  },
];

function validateSources() {
  const slugs = new Set<string>();
  for (const course of sources) {
    if (slugs.has(course.slug)) throw new Error(`Duplicate source slug: ${course.slug}`);
    slugs.add(course.slug);
    if (course.modules.length < 4) throw new Error(`${course.title} does not contain a complete multi-day curriculum.`);
    for (const module of course.modules) {
      if (!module.lessons.length) throw new Error(`${course.title} / ${module.title} has no lessons.`);
      for (const lesson of module.lessons) {
        if (!lesson.title.trim() || lesson.content.trim().length < 20 || lesson.durationMinutes <= 0) {
          throw new Error(`Invalid lesson in ${course.title} / ${module.title}: ${lesson.title}`);
        }
        if (/md2pdf\.netlify\.app|Assessment Answer Key/i.test(lesson.content)) {
          throw new Error(`Generator or answer-key content leaked into ${course.title} / ${lesson.title}`);
        }
      }
    }
  }
}

async function uploadHandout(source: CourseSource) {
  const filePath = path.join("/Users/appdev/courses", source.sourceFilename);
  const publicId = `${source.slug}.pdf`;
  const result = await cloudinary.uploader.upload(filePath, {
    resource_type: "raw",
    type: "upload",
    folder: "learnify/resources/course-handouts",
    public_id: publicId,
    overwrite: true,
    invalidate: true,
  });
  return {
    url: result.secure_url,
    name: `${source.title} — Candidate Course Booklet.pdf`,
  };
}

async function importCourse(source: CourseSource) {
  const handout = await uploadHandout(source);

  return db.transaction(async (tx) => {
    const [admin] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, "admin"))
      .limit(1);
    if (!admin) throw new Error("The live database has no administrator account.");

    let [category] = await tx
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.slug, source.category.slug))
      .limit(1);
    if (!category) {
      [category] = await tx
        .insert(schema.categories)
        .values({
          name: source.category.name,
          slug: source.category.slug,
          description: `${source.category.name} courses and professional development programmes.`,
          sortOrder: 10,
        })
        .returning();
    }

    const totalLectures = source.modules.reduce((sum, module) => sum + module.lessons.length, 0);
    const totalMinutes = source.modules.reduce(
      (sum, module) => sum + module.lessons.reduce((minutes, lesson) => minutes + lesson.durationMinutes, 0),
      0,
    );
    const courseValues = {
      title: source.title,
      shortDescription: source.shortDescription,
      description: source.description,
      price: "0.00",
      format: "in_person" as const,
      location: `${venueAddress}, ${venueCity} ${venuePostcode}`,
      status: "draft" as const,
      handoutUrl: handout.url,
      handoutName: handout.name,
      level: "beginner",
      language: "English",
      categoryId: category.id,
      createdBy: admin.id,
      totalLectures,
      totalDuration: totalMinutes * 60,
      requirements: JSON.stringify(source.requirements),
      whatYouLearn: JSON.stringify(source.whatYouLearn),
      updatedAt: new Date(),
    };

    let [course] = await tx
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.slug, source.slug))
      .limit(1);
    if (course) {
      [course] = await tx
        .update(schema.courses)
        .set(courseValues)
        .where(eq(schema.courses.id, course.id))
        .returning();
    } else {
      [course] = await tx
        .insert(schema.courses)
        .values({ slug: source.slug, ...courseValues })
        .returning();
    }

    for (const [moduleIndex, module] of source.modules.entries()) {
      let [section] = await tx
        .select()
        .from(schema.courseSections)
        .where(and(
          eq(schema.courseSections.courseId, course.id),
          eq(schema.courseSections.title, module.title),
        ))
        .limit(1);
      const sectionValues = {
        description: module.description,
        sortOrder: moduleIndex + 1,
        updatedAt: new Date(),
      };
      if (section) {
        [section] = await tx
          .update(schema.courseSections)
          .set(sectionValues)
          .where(eq(schema.courseSections.id, section.id))
          .returning();
      } else {
        [section] = await tx
          .insert(schema.courseSections)
          .values({ courseId: course.id, title: module.title, ...sectionValues })
          .returning();
      }

      for (const [lessonIndex, lesson] of module.lessons.entries()) {
        const [existing] = await tx
          .select({ id: schema.lectures.id })
          .from(schema.lectures)
          .where(and(
            eq(schema.lectures.sectionId, section.id),
            eq(schema.lectures.title, lesson.title),
          ))
          .limit(1);
        const lessonValues = {
          description: lesson.content,
          videoDuration: lesson.durationMinutes * 60,
          isFree: lesson.isFree ?? false,
          isPublished: true,
          sortOrder: lessonIndex + 1,
          updatedAt: new Date(),
        };
        if (existing) {
          await tx.update(schema.lectures).set(lessonValues).where(eq(schema.lectures.id, existing.id));
        } else {
          await tx.insert(schema.lectures).values({
            sectionId: section.id,
            title: lesson.title,
            ...lessonValues,
          });
        }
      }
    }

    for (const cohort of cohortTemplates) {
      const [existing] = await tx
        .select({ id: schema.courseSessions.id })
        .from(schema.courseSessions)
        .where(and(
          eq(schema.courseSessions.courseId, course.id),
          eq(schema.courseSessions.startDatetime, cohort.startDatetime),
        ))
        .limit(1);
      const sessionValues = {
        title: cohort.title,
        description: `A facilitator-led two-week ${source.title} cohort with guided learning, practical exercises, collaborative application and final-assessment support.`,
        startDatetime: cohort.startDatetime,
        endDatetime: cohort.endDatetime,
        capacity: 10,
        venueAddress,
        venueCity,
        venuePostcode,
        status: "scheduled" as const,
        updatedAt: new Date(),
      };
      if (existing) {
        await tx.update(schema.courseSessions).set(sessionValues).where(eq(schema.courseSessions.id, existing.id));
      } else {
        await tx.insert(schema.courseSessions).values({ courseId: course.id, ...sessionValues });
      }
    }

    return { title: source.title, modules: source.modules.length, lessons: totalLectures, minutes: totalMinutes };
  });
}

async function main() {
  validateSources();
  console.log(`Validated ${sources.length} course sources.`);
  for (const source of sources) {
    const lessons = source.modules.reduce((sum, module) => sum + module.lessons.length, 0);
    console.log(`- ${source.title}: ${source.modules.length} modules, ${lessons} lessons`);
  }
  if (dryRun) {
    console.log("Dry run complete: no uploads or database writes were performed.");
    return;
  }
  for (const source of sources) {
    const result = await importCourse(source);
    console.log(`Imported ${result.title}: ${result.modules} modules, ${result.lessons} lessons, ${result.minutes} minutes.`);
  }
}

main()
  .catch((error) => {
    console.error("Live course-booklet import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
