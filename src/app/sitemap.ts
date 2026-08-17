import { db } from "@/db";
import { courses, categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { MetadataRoute } from "next";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "https://learnify.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: APP,               lastModified: new Date(), changeFrequency: "weekly",  priority: 1.0 },
    { url: `${APP}/courses`,  lastModified: new Date(), changeFrequency: "daily",   priority: 0.9 },
    { url: `${APP}/login`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${APP}/register`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  const publishedCourses = await db
    .select({ slug: courses.slug, updatedAt: courses.updatedAt })
    .from(courses)
    .where(eq(courses.status, "published"));

  const coursePages: MetadataRoute.Sitemap = publishedCourses.map((c) => ({
    url:             `${APP}/courses/${c.slug}`,
    lastModified:    c.updatedAt,
    changeFrequency: "weekly" as const,
    priority:        0.8,
  }));

  const cats = await db
    .select({ slug: categories.slug, updatedAt: categories.updatedAt })
    .from(categories);

  const categoryPages: MetadataRoute.Sitemap = cats.map((cat) => ({
    url:             `${APP}/courses?category=${cat.slug}`,
    lastModified:    cat.updatedAt,
    changeFrequency: "weekly" as const,
    priority:        0.7,
  }));

  return [...staticPages, ...coursePages, ...categoryPages];
}
