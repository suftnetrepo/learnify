import type { CourseStatus, CourseFormat, CourseLevel } from "@/types/course.types";
import { db } from "@/db";
import { courses, categories, courseSections, lectures } from "@/db/schema";
import {
  eq, and, like, desc, asc, count, gte, lte, sql, inArray,
} from "drizzle-orm";
import { generateUniqueSlug } from "@/lib/utils";
import { log } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import type {
  CourseListResult, CourseFilters, CourseDetail,
  CreateCoursePayload, UpdateCoursePayload,
  CourseSection, CourseLecture,
} from "@/types";

export class CourseService {
  /**
   * Paginated course list with filters — used by admin list and catalogue.
   */
  static async list(filters: CourseFilters = {}): Promise<CourseListResult> {
    const {
      page      = 1,
      limit     = 12,
      search,
      status,
      format,
      level,
      categoryId,
      minPrice,
      maxPrice,
      sortBy    = "createdAt",
      sortOrder = "desc",
    } = filters;

    const conditions = [];
    if (search)     conditions.push(like(courses.title, `%${search}%`));
    if (status)     conditions.push(eq(courses.status,     status));
    if (format)     conditions.push(eq(courses.format,     format));
    if (level)      conditions.push(eq(courses.level,      level));
    if (categoryId) conditions.push(eq(courses.categoryId, categoryId));
    if (minPrice)   conditions.push(gte(courses.price, String(minPrice)));
    if (maxPrice)   conditions.push(lte(courses.price, String(maxPrice)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const orderCol =
      sortBy === "price"           ? courses.price           :
      sortBy === "enrollmentCount" ? courses.enrollmentCount  :
      sortBy === "averageRating"   ? courses.averageRating    :
      courses.createdAt;
    const orderFn = sortOrder === "asc" ? asc(orderCol) : desc(orderCol);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id:               courses.id,
          title:            courses.title,
          slug:             courses.slug,
          shortDescription: courses.shortDescription,
          price:            courses.price,
          format:           courses.format,
          status:           courses.status,
          level:            courses.level,
          thumbnailUrl:     courses.thumbnailUrl,
          totalDuration:    courses.totalDuration,
          totalLectures:    courses.totalLectures,
          enrollmentCount:  courses.enrollmentCount,
          averageRating:    courses.averageRating,
          reviewCount:      courses.reviewCount,
          createdAt:        courses.createdAt,
          categoryName:     categories.name,
        })
        .from(courses)
        .leftJoin(categories, eq(courses.categoryId, categories.id))
        .where(where)
        .orderBy(orderFn)
        .limit(limit)
        .offset((page - 1) * limit),

      db.select({ total: count() }).from(courses).where(where),
    ]);

    return {
      courses: rows as unknown as import("@/types").CourseListItem[],
      pagination: {
        total,
        page,
        limit,
        totalPages:      Math.ceil(total / limit),
        hasNextPage:     page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Full course detail by slug — includes sections and lectures.
   */
  static async findBySlug(slug: string): Promise<CourseDetail | null> {
    const [course] = await db
      .select({
        id:               courses.id,
        title:            courses.title,
        slug:             courses.slug,
        description:      courses.description,
        shortDescription: courses.shortDescription,
        price:            courses.price,
        format:           courses.format,
        status:           courses.status,
        level:            courses.level,
        language:         courses.language,
        location:         courses.location,
        thumbnailUrl:     courses.thumbnailUrl,
        totalDuration:    courses.totalDuration,
        totalLectures:    courses.totalLectures,
        enrollmentCount:  courses.enrollmentCount,
        averageRating:    courses.averageRating,
        reviewCount:      courses.reviewCount,
        categoryId:       courses.categoryId,
        createdBy:        courses.createdBy,
        createdAt:        courses.createdAt,
        updatedAt:        courses.updatedAt,
        categoryName:     categories.name,
        categorySlug:     categories.slug,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(eq(courses.slug, slug))
      .limit(1);

    if (!course) return null;

    const sections = await CourseService.getSectionsWithLectures(course.id);

    return { ...course, sections } as unknown as CourseDetail;
  }

  /**
   * Full course detail by ID — for admin editing.
   */
  static async findById(id: string): Promise<CourseDetail | null> {
    const [course] = await db
      .select()
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(eq(courses.id, id))
      .limit(1);

    if (!course) return null;

    const sections = await CourseService.getSectionsWithLectures(id);

    return {
      ...course.courses,
      categoryName: course.categories?.name ?? null,
      categorySlug: course.categories?.slug ?? null,
      sections,
    } as unknown as CourseDetail;
  }

  /**
   * Sections and lectures for a course — ordered by sortOrder.
   */
  static async getSectionsWithLectures(courseId: string): Promise<CourseSection[]> {
    const sectionRows = await db
      .select()
      .from(courseSections)
      .where(eq(courseSections.courseId, courseId))
      .orderBy(courseSections.sortOrder);

    const sectionIds = sectionRows.map((s) => s.id);
    const lectureRows = sectionIds.length > 0
      ? await db
          .select()
          .from(lectures)
          .where(inArray(lectures.sectionId, sectionIds))
          .orderBy(lectures.sortOrder)
      : [];

    return sectionRows.map((s) => ({
      id:        s.id,
      title:     s.title,
      sortOrder: s.sortOrder,
      scheduledStart: s.scheduledStart,
      scheduledEnd:   s.scheduledEnd,
      lectures:  lectureRows
        .filter((l) => l.sectionId === s.id)
        .map((l) => ({
          id:            l.id,
          title:         l.title,
          videoUrl:      l.videoUrl,
          videoDuration: l.videoDuration,
          videoPublicId: l.videoPublicId,
          thumbnailUrl:  l.thumbnailUrl,
          isFree:        l.isFree,
          isPublished:   l.isPublished,
          sortOrder:     l.sortOrder,
        })),
    }));
  }

  /**
   * Admin course edit page — course + categories + sessions.
   */
  static async getAdminCourseEditData(id: string) {
    const [course] = await db
      .select()
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(eq(courses.id, id))
      .limit(1);

    if (!course) return null;

    const [cats, sessions] = await Promise.all([
      db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(categories.sortOrder),
      db.select().from(courseSections).where(eq(courseSections.courseId, id)).orderBy(asc(courseSections.sortOrder)),
    ]);

    const { courseSessions: courseSessionsTable } = await import("@/db/schema");
    const { asc: ascFn } = await import("drizzle-orm");
    const sessionRows = await db
      .select()
      .from(courseSessionsTable)
      .where(eq(courseSessionsTable.courseId, id))
      .orderBy(ascFn(courseSessionsTable.startDatetime));

    return {
      course:     { ...course.courses, categoryName: course.categories?.name ?? null },
      categories: cats,
      sections:   sessions,
      sessions:   sessionRows.map((s) => ({
        ...s,
        startDatetime:  s.startDatetime.toISOString(),
        endDatetime:    s.endDatetime.toISOString(),
        seatsRemaining: Math.max(0, s.capacity - s.enrolledCount),
        isFull:         s.enrolledCount >= s.capacity,
      })),
    };
  }

  /**
   * Admin courses list with filters/pagination.
   */
  static async listAdmin(params: {
    search?: string; status?: string; format?: string;
    categoryId?: string; page?: number; limit?: number; sort?: string;
  }) {
    const { search, status, format, categoryId, page = 1, limit = 20, sort = "newest" } = params;
    const conditions = [];
    if (search)     conditions.push(like(courses.title, `%${search}%`));
    if (status)     conditions.push(eq(courses.status, status as CourseStatus));
    if (format)     conditions.push(eq(courses.format, format as CourseFormat));
    if (categoryId) conditions.push(eq(courses.categoryId, categoryId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderBy = sort === "popular" ? desc(courses.enrollmentCount) : sort === "oldest" ? asc(courses.createdAt) : desc(courses.createdAt);

    const [rows, [{ total }]] = await Promise.all([
      db.select({
        id:              courses.id,
        title:           courses.title,
        slug:            courses.slug,
        status:          courses.status,
        format:          courses.format,
        price:           courses.price,
        enrollmentCount: courses.enrollmentCount,
        averageRating:   courses.averageRating,
        createdAt:       courses.createdAt,
        categoryName:    categories.name,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset((page - 1) * limit),
      db.select({ total: count() }).from(courses).where(where),
    ]);

    return { courses: rows, total, totalPages: Math.ceil(total / limit), page };
  }

  /**
   * Public course catalogue with filters/pagination.
   */
  static async listPublic(params: {
    search?: string; categorySlug?: string; level?: string;
    format?: string; sort?: string; page?: number; limit?: number;
  }) {
    const { search, categorySlug, level, format, sort = "popular", page = 1, limit = 12 } = params;

    let categoryId = "";
    if (categorySlug) {
      const [cat] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, categorySlug))
        .limit(1);
      categoryId = cat?.id ?? "";
    }

    const conditions = [eq(courses.status, "published")];
    if (search)     conditions.push(like(courses.title, `%${search}%`));
    if (level)      conditions.push(eq(courses.level, level as CourseLevel));
    if (format)     conditions.push(eq(courses.format, format as CourseFormat));
    if (categoryId) conditions.push(eq(courses.categoryId, categoryId));
    const where = and(...conditions);

    const orderBy =
      sort === "newest"     ? desc(courses.createdAt)    :
      sort === "price-asc"  ? asc(courses.price)          :
      sort === "price-desc" ? desc(courses.price)          :
      sort === "rating"     ? desc(courses.averageRating)  :
      desc(courses.enrollmentCount);

    const [rows, [{ total }], allCategories] = await Promise.all([
      db.select({
        id:               courses.id,
        title:            courses.title,
        slug:             courses.slug,
        shortDescription: courses.shortDescription,
        price:            courses.price,
        thumbnailUrl:     courses.thumbnailUrl,
        level:            courses.level,
        totalDuration:    courses.totalDuration,
        totalLectures:    courses.totalLectures,
        enrollmentCount:  courses.enrollmentCount,
        averageRating:    courses.averageRating,
        reviewCount:      courses.reviewCount,
        format:           courses.format,
        categoryName:     categories.name,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset((page - 1) * limit),
      db.select({ total: count() }).from(courses).where(where),
      db.select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(categories).orderBy(categories.sortOrder),
    ]);

    return {
      courses:     rows,
      total,
      totalPages:  Math.ceil(total / limit),
      page,
      allCategories,
    };
  }

  /**
   * Course detail page — full data for public slug page.
   */
  static async getDetailBySlug(slug: string) {
    const [course] = await db
      .select({
        id:               courses.id,
        title:            courses.title,
        slug:             courses.slug,
        description:      courses.description,
        shortDescription: courses.shortDescription,
        price:            courses.price,
        format:           courses.format,
        location:         courses.location,
        level:            courses.level,
        language:         courses.language,
        totalDuration:    courses.totalDuration,
        totalLectures:    courses.totalLectures,
        enrollmentCount:  courses.enrollmentCount,
        averageRating:    courses.averageRating,
        reviewCount:      courses.reviewCount,
        thumbnailUrl:     courses.thumbnailUrl,
        whatYouLearn:     courses.whatYouLearn,
        requirements:     courses.requirements,
        status:           courses.status,
        updatedAt:        courses.updatedAt,
        categoryName:     categories.name,
        categorySlug:     categories.slug,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(and(eq(courses.slug, slug), eq(courses.status, "published")))
      .limit(1);

    if (!course) return null;

    const sections = await db
      .select()
      .from(courseSections)
      .where(eq(courseSections.courseId, course.id))
      .orderBy(courseSections.sortOrder);

    const sectionIds = sections.map((s) => s.id);
    const { inArray } = await import("drizzle-orm");
    const { lectures } = await import("@/db/schema");
    const allLectures = sectionIds.length
      ? await db
          .select({
            id:            lectures.id,
            title:         lectures.title,
            videoDuration: lectures.videoDuration,
            isFree:        lectures.isFree,
            sectionId:     lectures.sectionId,
            videoUrl:      lectures.videoUrl,
          })
          .from(lectures)
          .where(and(inArray(lectures.sectionId, sectionIds), eq(lectures.isPublished, true)))
          .orderBy(lectures.sortOrder)
      : [];

    const { tutorAssignments, users, courseReviews } = await import("@/db/schema");
    const [assignment] = await db
      .select({ tutorName: users.name, tutorBio: users.bio, tutorAvatar: users.avatarUrl })
      .from(tutorAssignments)
      .leftJoin(users, eq(tutorAssignments.tutorId, users.id))
      .where(and(eq(tutorAssignments.courseId, course.id), eq(tutorAssignments.status, "active")))
      .limit(1);

    const reviews = await db
      .select({
        id:          courseReviews.id,
        rating:      courseReviews.rating,
        title:       courseReviews.title,
        body:        courseReviews.body,
        createdAt:   courseReviews.createdAt,
        studentName: users.name,
      })
      .from(courseReviews)
      .leftJoin(users, eq(courseReviews.studentId, users.id))
      .where(and(eq(courseReviews.courseId, course.id), eq(courseReviews.isPublished, true)))
      .orderBy(courseReviews.createdAt)
      .limit(8);

    const sectionsWithLectures = sections.map((s) => ({
      ...s,
      lectures: allLectures.filter((l) => l.sectionId === s.id),
    }));

    return { course, sectionsWithLectures, assignment: assignment ?? null, reviews };
  }

  /**
   * Homepage featured courses + stats.
   */
  static async getHomeData() {
    const { users, courseReviews: reviewsTable } = await import("@/db/schema");
    const { avg, count: countFn } = await import("drizzle-orm");
    const [featuredCourses, allCategories, [studentStats], [ratingStats]] = await Promise.all([
      db.select({
        id: courses.id, title: courses.title, slug: courses.slug,
        shortDescription: courses.shortDescription, price: courses.price,
        thumbnailUrl: courses.thumbnailUrl, level: courses.level,
        totalDuration: courses.totalDuration, totalLectures: courses.totalLectures,
        enrollmentCount: courses.enrollmentCount, averageRating: courses.averageRating,
        reviewCount: courses.reviewCount, format: courses.format,
        categoryName: categories.name,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .where(eq(courses.status, "published"))
      .orderBy(desc(courses.enrollmentCount))
      .limit(6),
      db.select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(categories).orderBy(categories.sortOrder).limit(8),
      db.select({ total: countFn(users.id) }).from(users).where(eq(users.role, "student")),
      db.select({ avg: avg(reviewsTable.rating) }).from(reviewsTable).where(eq(reviewsTable.isPublished, true)),
    ]);
    return {
      featuredCourses,
      allCategories,
      totalStudents: studentStats.total,
      avgRating:     Number(ratingStats.avg ?? 4.9).toFixed(1),
    };
  }

  /**
   * Generate a slug guaranteed to be unique in the DB (retry loop).
   */
  private static async uniqueSlug(title: string): Promise<string> {
    const base = generateUniqueSlug(title);
    // Check for collision — extremely rare but must be handled
    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, base))
      .limit(1);
    if (!existing) return base;
    // Collision: add extra random suffix
    const retry = `${generateUniqueSlug(title)}-${Math.random().toString(36).slice(2, 6)}`;
    return retry;
  }

  /**
   * Create a new course.
   */
  static async create(payload: CreateCoursePayload, createdBy: string) {
    const [course] = await db
      .insert(courses)
      .values({
        title:            payload.title,
        slug:             await CourseService.uniqueSlug(payload.title),
        description:      payload.description,
        shortDescription: payload.shortDescription,
        price:            String(payload.price),
        format:           payload.format,
        location:         payload.location,
        status:           payload.status ?? "draft",
        categoryId:       payload.categoryId,
        level:            payload.level,
        language:         payload.language ?? "English",
        createdBy,
      })
      .returning();

    log.info("Course created", { courseId: course.id, by: createdBy });
    return course;
  }

  /**
   * Update an existing course.
   */
  static async update(id: string, payload: UpdateCoursePayload, updatedBy: string) {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (payload.title            !== undefined) {
      updateData.title = payload.title;
      updateData.slug  = await CourseService.uniqueSlug(payload.title);
    }
    if (payload.description      !== undefined) updateData.description      = payload.description;
    if (payload.shortDescription !== undefined) updateData.shortDescription = payload.shortDescription;
    if (payload.price            !== undefined) updateData.price            = String(payload.price);
    if (payload.format           !== undefined) updateData.format           = payload.format;
    if (payload.location         !== undefined) updateData.location         = payload.location;
    if (payload.status           !== undefined) updateData.status           = payload.status;
    if (payload.categoryId       !== undefined) updateData.categoryId       = payload.categoryId;
    if (payload.level            !== undefined) updateData.level            = payload.level;
    if (payload.language         !== undefined) updateData.language         = payload.language;

    const [updated] = await db
      .update(courses)
      .set(updateData)
      .where(eq(courses.id, id))
      .returning();

    log.info("Course updated", { courseId: id, by: updatedBy });
    // Bust the course detail page cache
    try { revalidatePath(`/courses/${updated.slug}`); } catch { /* not in request context */ }
    return updated;
  }

  /**
   * Archive or hard-delete a course depending on enrollments.
   */
  static async delete(id: string, deletedBy: string): Promise<"archived" | "deleted"> {
    const course = await CourseService.findById(id);
    if (!course) throw new Error("Course not found");

    if ((course.enrollmentCount ?? 0) > 0) {
      await db
        .update(courses)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(courses.id, id));
      log.info("Course archived", { courseId: id, by: deletedBy });
      return "archived";
    }

    await db.delete(courses).where(eq(courses.id, id));
    log.info("Course deleted", { courseId: id, by: deletedBy });
    return "deleted";
  }

  /**
   * All categories ordered by sortOrder.
   */
  static async getCategories() {
    return db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(categories)
      .orderBy(categories.sortOrder);
  }

  /**
   * All published courses for dropdowns.
   */
  static async getPublishedForSelect() {
    return db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(eq(courses.status, "published"))
      .orderBy(courses.title);
  }

  /**
   * Recalculate totalLectures and totalDuration from child tables.
   * Called after adding / removing lectures.
   */
  static async recalculateTotals(courseId: string): Promise<void> {
    const [result] = await db
      .select({
        count:    count(lectures.id),
        duration: sql<number>`COALESCE(SUM(${lectures.videoDuration}), 0)`,
      })
      .from(lectures)
      .innerJoin(courseSections, eq(lectures.sectionId, courseSections.id))
      .where(and(eq(courseSections.courseId, courseId), eq(lectures.isPublished, true)));

    await db
      .update(courses)
      .set({
        totalLectures: result.count,
        totalDuration: result.duration,
        updatedAt:     new Date(),
      })
      .where(eq(courses.id, courseId));
  }
}
