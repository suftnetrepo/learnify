/**
 * Idempotently creates or refreshes the Functional Programming Foundations
 * course from the supplied Candidate Edition handbook.
 *
 * Run with: npm run db:seed:programming-foundations
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { programmingFoundationsCourse as source } from "./course-content/programming-foundations";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Add it to .env.local before running this seed.");
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

async function main() {
  const [admin] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, "admin"))
    .limit(1);

  let [category] = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.slug, "web-development"))
    .limit(1);

  if (!category) {
    [category] = await db
      .insert(schema.categories)
      .values({
        name: "Web Development",
        slug: "web-development",
        description: "Programming and web development courses",
        sortOrder: 1,
      })
      .returning();
  }

  const totalLectures = source.modules.reduce((total, module) => total + module.lessons.length, 0);
  const totalMinutes = source.modules.reduce(
    (total, module) => total + module.lessons.reduce((minutes, lesson) => minutes + lesson.durationMinutes, 0),
    0,
  );

  const courseValues = {
    title: source.title,
    slug: source.slug,
    shortDescription: source.shortDescription,
    description: source.description,
    price: "0.00",
    format: "in_person" as const,
    location: "Royal Victoria Dock, 1 Western Gateway, London E16 1XL",
    status: "draft" as const,
    level: "beginner",
    language: "English",
    categoryId: category.id,
    createdBy: admin?.id ?? null,
    totalLectures,
    // Course totals are stored in seconds across the catalogue and checkout.
    totalDuration: totalMinutes * 60,
    requirements: JSON.stringify(source.requirements),
    whatYouLearn: JSON.stringify(source.whatYouLearn),
    updatedAt: new Date(),
  };

  let [course] = await db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.slug, source.slug))
    .limit(1);

  if (course) {
    [course] = await db
      .update(schema.courses)
      .set(courseValues)
      .where(eq(schema.courses.id, course.id))
      .returning();
  } else {
    [course] = await db.insert(schema.courses).values(courseValues).returning();
  }

  for (const [moduleIndex, module] of source.modules.entries()) {
    let [section] = await db
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
      [section] = await db
        .update(schema.courseSections)
        .set(sectionValues)
        .where(eq(schema.courseSections.id, section.id))
        .returning();
    } else {
      [section] = await db
        .insert(schema.courseSections)
        .values({
          courseId: course.id,
          title: module.title,
          ...sectionValues,
        })
        .returning();
    }

    for (const [lessonIndex, lesson] of module.lessons.entries()) {
      const [existingLesson] = await db
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

      if (existingLesson) {
        await db
          .update(schema.lectures)
          .set(lessonValues)
          .where(eq(schema.lectures.id, existingLesson.id));
      } else {
        await db.insert(schema.lectures).values({
          sectionId: section.id,
          title: lesson.title,
          ...lessonValues,
        });
      }
    }
  }

  for (const session of source.sessions) {
    const startDatetime = new Date(session.startDatetime);
    const endDatetime = new Date(session.endDatetime);
    const [existingSession] = await db
      .select({ id: schema.courseSessions.id })
      .from(schema.courseSessions)
      .where(and(
        eq(schema.courseSessions.courseId, course.id),
        eq(schema.courseSessions.startDatetime, startDatetime),
      ))
      .limit(1);

    const sessionValues = {
      title: session.title,
      description: session.description,
      startDatetime,
      endDatetime,
      capacity: session.capacity,
      venueAddress: session.venueAddress,
      venueCity: session.venueCity,
      venuePostcode: session.venuePostcode,
      status: "scheduled" as const,
      updatedAt: new Date(),
    };

    if (existingSession) {
      await db
        .update(schema.courseSessions)
        .set(sessionValues)
        .where(eq(schema.courseSessions.id, existingSession.id));
    } else {
      await db.insert(schema.courseSessions).values({
        courseId: course.id,
        ...sessionValues,
      });
    }
  }

  console.log(`Created or refreshed: ${source.title}`);
  console.log(`${source.modules.length} modules · ${totalLectures} lessons · ${totalMinutes} minutes`);
  const savedSessions = await db
    .select({
      title: schema.courseSessions.title,
      startDatetime: schema.courseSessions.startDatetime,
      endDatetime: schema.courseSessions.endDatetime,
      capacity: schema.courseSessions.capacity,
    })
    .from(schema.courseSessions)
    .where(eq(schema.courseSessions.courseId, course.id));
  const managedSessionStarts = new Set(source.sessions.map((session) => new Date(session.startDatetime).getTime()));
  const verifiedSessions = savedSessions.filter((session) => managedSessionStarts.has(session.startDatetime.getTime()));
  console.log(`${verifiedSessions.length} in-person sessions verified at Royal Victoria Dock`);
  for (const session of verifiedSessions) {
    console.log(
      `- ${session.title}: ${session.startDatetime.toISOString()} → ${session.endDatetime.toISOString()} · ${session.capacity} seats`,
    );
  }
  console.log("Status: draft (review in Admin → Courses before publishing)");
}

main()
  .catch((error) => {
    console.error("Programming Foundations seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
