/**
 * Development seed — run with: npm run db:seed
 * Creates admin, demo tutor, demo student, categories, and sample courses.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import bcrypt from "bcryptjs";

const client = postgres(process.env.DATABASE_URL!);
const db     = drizzle(client, { schema });

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Categories ────────────────────────────────────────────────────────────────
  const categoryData = [
    { name: "Web Development",      slug: "web-development",      sortOrder: 1 },
    { name: "Data Science",         slug: "data-science",          sortOrder: 2 },
    { name: "Design",               slug: "design",                sortOrder: 3 },
    { name: "Business",             slug: "business",              sortOrder: 4 },
    { name: "Marketing",            slug: "marketing",             sortOrder: 5 },
    { name: "Photography",          slug: "photography",           sortOrder: 6 },
    { name: "Personal Development", slug: "personal-development",  sortOrder: 7 },
    { name: "Music",                slug: "music",                 sortOrder: 8 },
  ];

  const categories = await db
    .insert(schema.categories)
    .values(categoryData)
    .onConflictDoNothing()
    .returning();

  console.log(`✓ ${categories.length} categories seeded`);

  // ── Users ─────────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Password1", 12);

  const [admin] = await db
    .insert(schema.users)
    .values({
      name: "Platform Admin", email: "admin@learnify.dev",
      passwordHash, role: "admin", status: "active", emailVerified: true,
    })
    .onConflictDoNothing().returning();

  const [tutor] = await db
    .insert(schema.users)
    .values({
      name: "Sarah Chen", email: "tutor@learnify.dev",
      passwordHash, role: "tutor", status: "active", emailVerified: true,
      bio: "Full-stack engineer with 8 years building production apps.",
    })
    .onConflictDoNothing().returning();

  const [student] = await db
    .insert(schema.users)
    .values({
      name: "Alex Rivera", email: "student@learnify.dev",
      passwordHash, role: "student", status: "active", emailVerified: true,
    })
    .onConflictDoNothing().returning();

  console.log("✓ Seed users created:");
  console.log("  admin@learnify.dev   → Password1  (admin)");
  console.log("  tutor@learnify.dev   → Password1  (tutor)");
  console.log("  student@learnify.dev → Password1  (student)");

  // ── Sample Courses ────────────────────────────────────────────────────────────
  if (admin && categories.length > 0) {
    const webCat = categories.find((c) => c.slug === "web-development");
    const dsCat  = categories.find((c) => c.slug === "data-science");

    const coursesResult = await db
      .insert(schema.courses)
      .values([
        {
          title: "Next.js 15 Masterclass", slug: "nextjs-15-masterclass",
          description: "Build production-grade full-stack apps with Next.js 15, TypeScript, and Tailwind CSS.",
          shortDescription: "From zero to production with Next.js 15.",
          price: "149.00", format: "online", status: "published",
          categoryId: webCat?.id, createdBy: admin.id,
          level: "intermediate", totalLectures: 48, totalDuration: 1200,
        },
        {
          title: "Python for Data Science", slug: "python-data-science",
          description: "Master Python, pandas, NumPy, and scikit-learn for real-world data problems.",
          shortDescription: "Practical data science with Python.",
          price: "129.00", format: "online", status: "published",
          categoryId: dsCat?.id, createdBy: admin.id,
          level: "beginner", totalLectures: 36, totalDuration: 900,
        },
        {
          title: "Advanced TypeScript Workshop", slug: "advanced-typescript-workshop",
          description: "Deep dive into TypeScript generics, decorators, and advanced patterns.",
          shortDescription: "Level up your TypeScript skills.",
          price: "89.00", format: "in_person",
          location: "London Tech Hub, EC2A 4NE",
          status: "draft", categoryId: webCat?.id, createdBy: admin.id,
          level: "advanced", totalLectures: 12, totalDuration: 360,
        },
      ])
      .onConflictDoNothing()
      .returning();

    console.log(`✓ ${coursesResult.length} sample courses seeded`);

    // Assign tutor to first published course
    if (tutor && coursesResult[0]) {
      await db
        .insert(schema.tutorAssignments)
        .values({
          courseId:   coursesResult[0].id,
          tutorId:    tutor.id,
          assignedBy: admin.id,
          startDate:  new Date(),
          endDate:    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          status:     "active",
        })
        .onConflictDoNothing();

      console.log("✓ Tutor assigned to Next.js 15 Masterclass");
    }
  }

  console.log("\n✅ Seed complete");
  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
