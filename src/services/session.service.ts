import { db } from "@/db";
import { courseSessions, courseSessionWaitlist, enrollments, courses } from "@/db/schema";
import { eq, and, gt, gte, asc, count, sql } from "drizzle-orm";
import { log } from "@/lib/logger";
import type { CourseSession, WaitlistEntry } from "@/db/schema";

export interface CreateSessionPayload {
  courseId:           string;
  title:              string;
  description?:       string;
  startDatetime:      string;  // ISO string
  endDatetime:        string;  // ISO string
  capacity:           number;
  // In-person / hybrid
  venueAddress?:      string;
  venueCity?:         string;
  venuePostcode?:     string;
  venueMapUrl?:       string;
  // Online-live
  conferencePlatform?: "zoom" | "teams" | "google_meet" | "webex" | "other";
  conferenceUrl?:     string;
  conferencePassword?: string;
}

export interface UpdateSessionPayload extends Partial<Omit<CreateSessionPayload, "courseId">> {
  status?: "scheduled" | "cancelled" | "completed";
}

export interface SessionWithStats extends CourseSession {
  seatsRemaining: number;
  isFull:         boolean;
}

export class SessionService {

  /** All sessions for a course ordered by start date. */
  static async getForCourse(courseId: string): Promise<SessionWithStats[]> {
    const rows = await db
      .select()
      .from(courseSessions)
      .where(eq(courseSessions.courseId, courseId))
      .orderBy(asc(courseSessions.startDatetime));

    return rows.map((s) => ({
      ...s,
      seatsRemaining: Math.max(0, s.capacity - s.enrolledCount),
      isFull:         s.enrolledCount >= s.capacity,
    }));
  }

  /** Upcoming scheduled sessions only — for the catalogue / checkout. */
  static async getUpcomingForCourse(courseId: string): Promise<SessionWithStats[]> {
    const now  = new Date();
    const rows = await db
      .select()
      .from(courseSessions)
      .where(
        and(
          eq(courseSessions.courseId,  courseId),
          eq(courseSessions.status,    "scheduled"),
          gt(courseSessions.startDatetime, now)
        )
      )
      .orderBy(asc(courseSessions.startDatetime));

    return rows.map((s) => ({
      ...s,
      seatsRemaining: Math.max(0, s.capacity - s.enrolledCount),
      isFull:         s.enrolledCount >= s.capacity,
    }));
  }

  /** Single session by ID. */
  static async findById(id: string): Promise<SessionWithStats | null> {
    const [row] = await db
      .select()
      .from(courseSessions)
      .where(eq(courseSessions.id, id))
      .limit(1);

    if (!row) return null;
    return {
      ...row,
      seatsRemaining: Math.max(0, row.capacity - row.enrolledCount),
      isFull:         row.enrolledCount >= row.capacity,
    };
  }

  /** Create a new session. */
  static async create(payload: CreateSessionPayload, createdBy: string): Promise<CourseSession> {
    const start = new Date(payload.startDatetime);
    const end   = new Date(payload.endDatetime);

    if (end <= start) throw new Error("End time must be after start time");

    const [session] = await db
      .insert(courseSessions)
      .values({
        courseId:           payload.courseId,
        title:              payload.title,
        description:        payload.description        ?? null,
        startDatetime:      start,
        endDatetime:        end,
        capacity:           payload.capacity,
        venueAddress:       payload.venueAddress       ?? null,
        venueCity:          payload.venueCity          ?? null,
        venuePostcode:      payload.venuePostcode      ?? null,
        venueMapUrl:        payload.venueMapUrl        ?? null,
        conferencePlatform: payload.conferencePlatform ?? null,
        conferenceUrl:      payload.conferenceUrl      ?? null,
        conferencePassword: payload.conferencePassword ?? null,
        status:             "scheduled",
      })
      .returning();

    log.info("Session created", { sessionId: session.id, courseId: payload.courseId, by: createdBy });
    return session;
  }

  /** Update an existing session. */
  static async update(id: string, payload: UpdateSessionPayload, updatedBy: string): Promise<CourseSession> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (payload.title              !== undefined) updateData.title              = payload.title;
    if (payload.description        !== undefined) updateData.description        = payload.description;
    if (payload.startDatetime      !== undefined) updateData.startDatetime      = new Date(payload.startDatetime);
    if (payload.endDatetime        !== undefined) updateData.endDatetime        = new Date(payload.endDatetime);
    if (payload.capacity           !== undefined) updateData.capacity           = payload.capacity;
    if (payload.venueAddress       !== undefined) updateData.venueAddress       = payload.venueAddress;
    if (payload.venueCity          !== undefined) updateData.venueCity          = payload.venueCity;
    if (payload.venuePostcode      !== undefined) updateData.venuePostcode      = payload.venuePostcode;
    if (payload.venueMapUrl        !== undefined) updateData.venueMapUrl        = payload.venueMapUrl;
    if (payload.conferencePlatform !== undefined) updateData.conferencePlatform = payload.conferencePlatform;
    if (payload.conferenceUrl      !== undefined) updateData.conferenceUrl      = payload.conferenceUrl;
    if (payload.conferencePassword !== undefined) updateData.conferencePassword = payload.conferencePassword;
    if (payload.status             !== undefined) updateData.status             = payload.status;

    const [updated] = await db
      .update(courseSessions)
      .set(updateData)
      .where(eq(courseSessions.id, id))
      .returning();

    log.info("Session updated", { sessionId: id, by: updatedBy });
    return updated;
  }

  /** Delete a session — only if no enrollments are linked. */
  static async delete(id: string, deletedBy: string): Promise<void> {
    const [{ total }] = await db
      .select({ total: count() })
      .from(enrollments)
      .where(eq(enrollments.sessionId, id));

    if (total > 0) {
      throw new Error("Cannot delete a session that has enrolled students. Cancel it instead.");
    }

    await db.delete(courseSessions).where(eq(courseSessions.id, id));
    log.info("Session deleted", { sessionId: id, by: deletedBy });
  }

  /** Cancel a session — marks it cancelled and all linked enrollments remain but are flagged. */
  static async cancel(id: string, cancelledBy: string): Promise<void> {
    await db
      .update(courseSessions)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(courseSessions.id, id));

    log.info("Session cancelled", { sessionId: id, by: cancelledBy });
  }

  /**
   * Reserve a seat in a session (called at checkout time).
   * Atomically increments enrolledCount and returns the session.
   * Throws if full.
   */
  static async reserveSeat(sessionId: string): Promise<CourseSession> {
    // Atomic increment with capacity check
    const [updated] = await db
      .update(courseSessions)
      .set({
        enrolledCount: sql`${courseSessions.enrolledCount} + 1`,
        updatedAt:     new Date(),
      })
      .where(
        and(
          eq(courseSessions.id, sessionId),
          eq(courseSessions.status, "scheduled"),
          sql`enrolled_count < capacity`
        )
      )
      .returning();

    if (!updated) {
      throw new Error("Session is full or no longer available");
    }

    return updated;
  }

  /** Release a seat (on refund). */
  static async releaseSeat(sessionId: string): Promise<void> {
    await db
      .update(courseSessions)
      .set({
        enrolledCount: sql`GREATEST(0, ${courseSessions.enrolledCount} - 1)`,
        updatedAt:     new Date(),
      })
      .where(eq(courseSessions.id, sessionId));
  }

  // ─── Waitlist ────────────────────────────────────────────────────────────────

  /** Add student to waitlist. Returns position. */
  static async joinWaitlist(sessionId: string, studentId: string): Promise<WaitlistEntry> {
    // Check not already on waitlist
    const [existing] = await db
      .select({ id: courseSessionWaitlist.id })
      .from(courseSessionWaitlist)
      .where(
        and(
          eq(courseSessionWaitlist.sessionId, sessionId),
          eq(courseSessionWaitlist.studentId, studentId)
        )
      )
      .limit(1);

    if (existing) throw new Error("Already on waitlist for this session");

    // Get next position
    const [{ maxPos }] = await db
      .select({ maxPos: sql<number>`COALESCE(MAX(${courseSessionWaitlist.position}), 0)` })
      .from(courseSessionWaitlist)
      .where(eq(courseSessionWaitlist.sessionId, sessionId));

    const [entry] = await db
      .insert(courseSessionWaitlist)
      .values({ sessionId, studentId, position: (maxPos ?? 0) + 1 })
      .returning();

    return entry;
  }

  /** Get waitlist for a session ordered by position. */
  static async getWaitlist(sessionId: string): Promise<WaitlistEntry[]> {
    return db
      .select()
      .from(courseSessionWaitlist)
      .where(eq(courseSessionWaitlist.sessionId, sessionId))
      .orderBy(asc(courseSessionWaitlist.position));
  }

  /** Get a student's enrolled session for a course. */
  static async getStudentSession(studentId: string, courseId: string): Promise<SessionWithStats | null> {
    const [enrollment] = await db
      .select({ sessionId: enrollments.sessionId })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
      .limit(1);

    if (!enrollment?.sessionId) return null;
    return SessionService.findById(enrollment.sessionId);
  }

  /**
   * Instructor sessions page — all sessions for a tutor's assigned courses.
   */
  static async getInstructorSessions(tutorId: string) {
    const { tutorAssignments, courseSessions, courses, enrollments, users } = await import("@/db/schema");
    const { eq, and, asc, desc, inArray } = await import("drizzle-orm");

    const assignments = await db
      .select({ courseId: tutorAssignments.courseId })
      .from(tutorAssignments)
      .where(and(eq(tutorAssignments.tutorId, tutorId), eq(tutorAssignments.status, "active")));

    const courseIds = assignments.map((a) => a.courseId);
    if (!courseIds.length) return [];

    const sessions = await db
      .select({
        id:               courseSessions.id,
        courseId:         courseSessions.courseId,
        title:            courseSessions.title,
        startDatetime:    courseSessions.startDatetime,
        endDatetime:      courseSessions.endDatetime,
        capacity:         courseSessions.capacity,
        enrolledCount:    courseSessions.enrolledCount,
        status:           courseSessions.status,
        conferencePlatform: courseSessions.conferencePlatform,
        conferenceUrl:    courseSessions.conferenceUrl,
        venueAddress:     courseSessions.venueAddress,
        venueCity:        courseSessions.venueCity,
        courseTitle:      courses.title,
        courseSlug:       courses.slug,
      })
      .from(courseSessions)
      .leftJoin(courses, eq(courseSessions.courseId, courses.id))
      .where(inArray(courseSessions.courseId, courseIds))
      .orderBy(asc(courseSessions.startDatetime));

    return sessions;
  }

}