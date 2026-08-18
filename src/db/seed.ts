/**
 * Development seed — run with: npm run db:seed
 * Creates admin, demo tutor, demo student, categories, and sample courses.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { courseSections, lectures } from "@/db/schema";
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

  let [admin] = await db
    .insert(schema.users)
    .values({
      name: "Platform Admin", email: "admin@learnify.dev",
      passwordHash, role: "admin", status: "active", emailVerified: true,
    })
    .onConflictDoNothing().returning();

  // .returning() above is empty when the admin user already exists (conflict) —
  // look it up so course seeding below still has a valid createdBy on repeat runs.
  if (!admin) {
    [admin] = await db.select().from(schema.users).where(eq(schema.users.email, "admin@learnify.dev"));
  }

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
  if (admin) {
    // Look up category IDs by slug directly from the table — the insert's
    // .returning() above is empty for rows that already existed (conflict),
    // so it can't be relied on to resolve categoryId on repeat seed runs.
    const [dataScienceCat] = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.slug, "data-science"));
    const [webDevCat] = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.slug, "web-development"));

    const coursesResult = await db
      .insert(schema.courses)
      .values([
        {
          title: "AI & Machine Learning Fundamentals", slug: "ai-machine-learning-fundamentals",
          shortDescription: "Build a solid foundation in artificial intelligence and machine learning. Go from zero to building your first predictive model in Python.",
          price: "299.00", format: "online", status: "published",
          categoryId: dataScienceCat?.id, createdBy: admin.id,
          level: "beginner", totalLectures: 64, totalDuration: 79200,
          enrollmentCount: 1247, averageRating: "4.8", reviewCount: 312,
          thumbnailUrl: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80",
          whatYouLearn: JSON.stringify([
            "Understand the core concepts of supervised and unsupervised machine learning",
            "Build and train predictive models using Python and Scikit-learn",
            "Clean, transform, and visualise data using Pandas and Matplotlib",
            "Evaluate model performance and prevent overfitting",
            "Build a sentiment analyser using natural language processing",
            "Deploy a trained model as a REST API endpoint",
          ]),
          requirements: JSON.stringify([
            "Basic Python knowledge (variables, loops, functions)",
            "A laptop with internet access — all tools are free and browser-based",
            "No prior machine learning or statistics experience required",
          ]),
        },
        {
          title: "iOS Development with SwiftUI", slug: "ios-development-swiftui",
          shortDescription: "Build real iOS apps from scratch using SwiftUI. Master Apple's modern declarative UI framework and ship your first app to the App Store.",
          price: "249.00", format: "online", status: "published",
          categoryId: webDevCat?.id, createdBy: admin.id,
          level: "intermediate", totalLectures: 58, totalDuration: 68400,
          enrollmentCount: 843, averageRating: "4.9", reviewCount: 198,
          thumbnailUrl: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=80",
          whatYouLearn: JSON.stringify([
            "Build iOS apps using SwiftUI's declarative syntax",
            "Manage app state with @State, @Binding, @ObservedObject, and @EnvironmentObject",
            "Navigate between screens using NavigationStack and TabView",
            "Fetch and display data from REST APIs using async/await",
            "Persist data locally using CoreData and UserDefaults",
            "Submit a finished app to the Apple App Store",
          ]),
          requirements: JSON.stringify([
            "A Mac running macOS Ventura or later (required for Xcode)",
            "Basic programming knowledge in any language",
            "No prior Swift or iOS experience needed",
          ]),
        },
        {
          title: "Data Science with Python — Zero to Professional", slug: "data-science-python-zero-to-professional",
          shortDescription: "A complete data science bootcamp. From data cleaning and visualisation to advanced statistical analysis and machine learning pipelines.",
          price: "349.00", format: "online", status: "published",
          categoryId: dataScienceCat?.id, createdBy: admin.id,
          level: "beginner", totalLectures: 96, totalDuration: 115200,
          enrollmentCount: 2156, averageRating: "4.7", reviewCount: 541,
          thumbnailUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
          whatYouLearn: JSON.stringify([
            "Clean and transform messy real-world datasets using Pandas",
            "Create professional data visualisations with Matplotlib and Seaborn",
            "Perform statistical analysis and hypothesis testing",
            "Build end-to-end machine learning pipelines with Scikit-learn",
            "Work with SQL databases to query and extract data",
            "Present findings clearly using Jupyter notebooks and dashboards",
          ]),
          requirements: JSON.stringify([
            "No prior data science or statistics background required",
            "Basic familiarity with Python is helpful but not essential",
            "Windows, Mac, or Linux — all software used is free",
          ]),
        },
        {
          title: "Prompt Engineering & AI Tools for Professionals", slug: "prompt-engineering-ai-tools-professionals",
          shortDescription: "Learn to work with AI as a professional collaborator. Master prompt engineering, build AI-powered workflows, and stay ahead in your field.",
          price: "149.00", format: "online", status: "published",
          categoryId: dataScienceCat?.id, createdBy: admin.id,
          level: "beginner", totalLectures: 34, totalDuration: 28800,
          enrollmentCount: 3892, averageRating: "4.9", reviewCount: 876,
          thumbnailUrl: "https://images.unsplash.com/photo-1655720828018-edd2daec9349?w=800&q=80",
          whatYouLearn: JSON.stringify([
            "Write prompts that produce consistently high-quality outputs",
            "Build multi-step AI workflows that automate repetitive tasks",
            "Use AI tools for research, writing, analysis, and ideation",
            "Evaluate AI outputs critically and catch hallucinations",
            "Integrate AI into your existing tools (email, slides, spreadsheets)",
            "Stay current as AI tools evolve rapidly",
          ]),
          requirements: JSON.stringify([
            "No technical background required — this course is for non-developers",
            "Access to ChatGPT, Claude, or any major AI assistant (free tier is fine)",
            "An open mind — this field moves fast",
          ]),
        },
        {
          title: "Android Development with Kotlin & Jetpack Compose", slug: "android-development-kotlin-jetpack-compose",
          shortDescription: "Build modern Android apps using Kotlin and Jetpack Compose — Google's recommended approach for native Android UI development.",
          price: "229.00", format: "online", status: "published",
          categoryId: webDevCat?.id, createdBy: admin.id,
          level: "intermediate", totalLectures: 61, totalDuration: 72000,
          enrollmentCount: 671, averageRating: "4.8", reviewCount: 143,
          thumbnailUrl: "https://images.unsplash.com/photo-1607252650355-f7fd0460ccdb?w=800&q=80",
          whatYouLearn: JSON.stringify([
            "Build Android UIs declaratively using Jetpack Compose",
            "Understand Kotlin fundamentals including coroutines and flows",
            "Manage app architecture using ViewModel and StateFlow",
            "Store data locally using Room database",
            "Consume REST APIs using Retrofit and handle loading/error states",
            "Publish a finished app to the Google Play Store",
          ]),
          requirements: JSON.stringify([
            "Basic programming knowledge in any language",
            "A computer capable of running Android Studio (8GB RAM recommended)",
            "No prior Android or Kotlin experience required",
          ]),
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

      console.log(`✓ Tutor assigned to ${coursesResult[0].title}`);
    }

    // ── Curriculum for the AI & Machine Learning course ──────────────────────
    const [aiCourse] = await db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.slug, "ai-machine-learning-fundamentals"));

    if (aiCourse) {
      const curriculum: {
        title: string;
        lectures: { title: string; videoDuration: number; isFree: boolean }[];
      }[] = [
        {
          title: "Getting Started with Python for Data Science",
          lectures: [
            { title: "Welcome & course overview",                    videoDuration: 420,  isFree: true },
            { title: "Setting up your environment",                  videoDuration: 780,  isFree: true },
            { title: "Python crash course — variables and types",    videoDuration: 1200, isFree: false },
            { title: "Lists dictionaries and loops",                 videoDuration: 1440, isFree: false },
            { title: "Functions and modules",                        videoDuration: 1080, isFree: false },
          ],
        },
        {
          title: "NumPy & Pandas — Working with Data",
          lectures: [
            { title: "Introduction to NumPy arrays",                 videoDuration: 1320, isFree: false },
            { title: "Array operations and broadcasting",            videoDuration: 1200, isFree: false },
            { title: "Loading data with Pandas DataFrames",          videoDuration: 1440, isFree: true },
            { title: "Cleaning missing and duplicate data",          videoDuration: 1680, isFree: false },
            { title: "Grouping filtering and aggregating",           videoDuration: 1560, isFree: false },
            { title: "Project: Clean a real housing dataset",        videoDuration: 2400, isFree: false },
          ],
        },
        {
          title: "Your First Machine Learning Model",
          lectures: [
            { title: "What is machine learning? Core concepts",      videoDuration: 1080, isFree: true },
            { title: "Supervised vs unsupervised learning",          videoDuration: 960,  isFree: false },
            { title: "Train/test split and cross-validation",        videoDuration: 1320, isFree: false },
            { title: "Linear regression from scratch",               videoDuration: 1800, isFree: false },
            { title: "Your first Scikit-learn model",                videoDuration: 1560, isFree: false },
            { title: "Evaluating model performance",                 videoDuration: 1200, isFree: false },
            { title: "Project: Predict house prices",                videoDuration: 3600, isFree: false },
          ],
        },
        {
          title: "Classification Algorithms",
          lectures: [
            { title: "Logistic regression explained",                videoDuration: 1440, isFree: false },
            { title: "Decision trees and how they work",             videoDuration: 1680, isFree: false },
            { title: "Random forests and ensemble methods",          videoDuration: 1560, isFree: false },
            { title: "Evaluating classifiers",                       videoDuration: 1320, isFree: false },
            { title: "Project: Build a spam classifier",             videoDuration: 3000, isFree: false },
          ],
        },
        {
          title: "Introduction to Deep Learning",
          lectures: [
            { title: "Neural networks — the intuition",              videoDuration: 1440, isFree: false },
            { title: "Building your first neural net with TensorFlow", videoDuration: 1800, isFree: false },
            { title: "Convolutional networks for images",            videoDuration: 2160, isFree: false },
            { title: "Project: Image classifier cats vs dogs",       videoDuration: 4200, isFree: false },
            { title: "Where to go next",                             videoDuration: 600,  isFree: false },
          ],
        },
      ];

      let lectureCount = 0;
      for (const [i, section] of curriculum.entries()) {
        const [insertedSection] = await db
          .insert(courseSections)
          .values({ courseId: aiCourse.id, title: section.title, sortOrder: i + 1 })
          .returning();

        if (!insertedSection) continue;

        await db.insert(lectures).values(
          section.lectures.map((lecture, j) => ({
            sectionId:    insertedSection.id,
            title:        lecture.title,
            videoDuration: lecture.videoDuration,
            isFree:       lecture.isFree,
            isPublished:  true,
            sortOrder:    j + 1,
          }))
        );
        lectureCount += section.lectures.length;
      }

      console.log(`✓ ${curriculum.length} sections and ${lectureCount} lectures seeded for AI & Machine Learning Fundamentals`);
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
