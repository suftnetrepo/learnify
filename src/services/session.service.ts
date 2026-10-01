import { db } from "@/db";
import { courseSessions, courseSessionWaitlist, enrollments, courses, users } from "@/db/schema";
import { eq, and, gt, asc, count, sql, isNull } from "drizzle-orm";
import { log } from "@/lib/logger";
import { EmailService } from "@/services/email.service";
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
  // Hidden from students and not bookable when false (default true)
  isPublished?:       boolean;
}

/** Optional text fields that an edit may clear by sending null. */
type ClearableSessionField =
  | "description" | "venueAddress" | "venueCity" | "venuePostcode" | "venueMapUrl"
  | "conferencePlatform" | "conferenceUrl" | "conferencePassword";

export type UpdateSessionPayload =
  Partial<Omit<CreateSessionPayload, "courseId" | ClearableSessionField>> &
  { [K in ClearableSessionField]?: CreateSessionPayload[K] | null } &
  { status?: "scheduled" | "cancelled" | "completed" };

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
  /**
   * Whether enrolling must be tied to a session. In-person/hybrid always are;
   * an online course is too once it has ever been scheduled — otherwise, when its
   * last session passes, it would silently become buyable with nothing to attend.
   * Online courses that have never had sessions are self-paced.
   */
  static async requiresSession(courseId: string, format: string): Promise<boolean> {
    if (format === "in_person" || format === "hybrid") return true;
    const [row] = await db
      .select({ id: courseSessions.id })
      .from(courseSessions)
      .where(eq(courseSessions.courseId, courseId))
      .limit(1);
    return !!row;
  }

  /**
   * Who may see a session's join link and password: admins, tutors with access to the
   * course, and students enrolled on it. Everyone else gets the session without them.
   */
  static async canSeeJoinDetails(userId: string | undefined, role: string | undefined, courseId: string): Promise<boolean> {
    if (!userId || !role) return false;
    if (role === "admin") return true;
    if (role === "tutor") {
      const { requireCourseAccess } = await import("@/lib/access/course");
      return requireCourseAccess(userId, courseId, role, "viewer");
    }
    const [row] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, userId), eq(enrollments.courseId, courseId)))
      .limit(1);
    return !!row;
  }

  /** Admins and tutors with access to the course see unpublished sessions; nobody else does. */
  static async canManageCourseSessions(userId: string | undefined, role: string | undefined, courseId: string): Promise<boolean> {
    if (!userId || !role) return false;
    if (role === "admin") return true;
    if (role !== "tutor") return false;
    const { requireCourseAccess } = await import("@/lib/access/course");
    return requireCourseAccess(userId, courseId, role, "viewer");
  }

  /** The session with its join link and password removed (platform name kept). */
  static withoutJoinDetails<T extends { conferenceUrl: string | null; conferencePassword: string | null }>(session: T): T {
    return { ...session, conferenceUrl: null, conferencePassword: null };
  }

  static async getUpcomingForCourse(courseId: string): Promise<SessionWithStats[]> {
    const now  = new Date();
    const rows = await db
      .select()
      .from(courseSessions)
      .where(
        and(
          eq(courseSessions.courseId,  courseId),
          eq(courseSessions.status,    "scheduled"),
          eq(courseSessions.isPublished, true),   // unpublished sessions aren't offered for booking
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
        isPublished:        payload.isPublished ?? true,
      })
      .returning();

    log.info("Session created", { sessionId: session.id, courseId: payload.courseId, by: createdBy });
    return session;
  }

  /** Update an existing session. */
  static async update(
    id: string, payload: UpdateSessionPayload, updatedBy: string,
  ): Promise<CourseSession & { studentsNotified: number }> {
    const existing = await SessionService.findById(id);
    if (!existing) throw new Error("Session not found");
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
    if (payload.isPublished        !== undefined) updateData.isPublished        = payload.isPublished;

    const [updated] = await db
      .update(courseSessions)
      .set(updateData)
      .where(eq(courseSessions.id, id))
      .returning();

    log.info("Session updated", { sessionId: id, by: updatedBy });
    let studentsNotified = 0;
    if (payload.status === "cancelled" && existing.status !== "cancelled") {
      await SessionService.notifySessionCancellation(updated);
    } else if (updated.status === "scheduled" && updated.endDatetime > new Date()) {
      const changes = SessionService.studentFacingChanges(existing, updated);
      if (changes.length) {
        // Never let an email problem fail the save itself
        studentsNotified = await SessionService.notifySessionUpdate(updated, changes).catch((error) => {
          log.error("Session update email failed", { sessionId: id, error });
          return 0;
        });
      }
    }
    return { ...updated, studentsNotified };
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
    await SessionService.update(id, { status: "cancelled" }, cancelledBy);
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

    const [waiting] = await db
      .select({
        waitlistId: courseSessionWaitlist.id,
        email: users.email,
        studentName: users.name,
        sessionTitle: courseSessions.title,
        courseTitle: courses.title,
      })
      .from(courseSessionWaitlist)
      .innerJoin(users, eq(courseSessionWaitlist.studentId, users.id))
      .innerJoin(courseSessions, eq(courseSessionWaitlist.sessionId, courseSessions.id))
      .innerJoin(courses, eq(courseSessions.courseId, courses.id))
      .where(and(eq(courseSessionWaitlist.sessionId, sessionId), isNull(courseSessionWaitlist.notifiedAt)))
      .orderBy(asc(courseSessionWaitlist.position))
      .limit(1);

    if (waiting) {
      await db.update(courseSessionWaitlist)
        .set({ notifiedAt: new Date() })
        .where(eq(courseSessionWaitlist.id, waiting.waitlistId));
      await EmailService.waitlistSeatAvailable(waiting.email, {
        studentName: waiting.studentName ?? "there",
        courseTitle: waiting.courseTitle,
        sessionTitle: waiting.sessionTitle,
      });
    }
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

    const [details] = await db
      .select({
        email: users.email,
        studentName: users.name,
        sessionTitle: courseSessions.title,
        courseTitle: courses.title,
      })
      .from(courseSessions)
      .innerJoin(courses, eq(courseSessions.courseId, courses.id))
      .innerJoin(users, eq(users.id, studentId))
      .where(eq(courseSessions.id, sessionId))
      .limit(1);

    if (details) {
      await EmailService.waitlistJoined(details.email, {
        studentName: details.studentName ?? "there",
        courseTitle: details.courseTitle,
        sessionTitle: details.sessionTitle,
        position: entry.position,
      });
    }

    return entry;
  }

  /** What changed that booked students need to know about (title/description/seats don't count). */
  private static studentFacingChanges(before: CourseSession, after: CourseSession): string[] {
    const changed = (keys: (keyof CourseSession)[]) =>
      keys.some((k) => String(before[k] instanceof Date ? (before[k] as Date).getTime() : before[k] ?? "")
                    !== String(after[k]  instanceof Date ? (after[k]  as Date).getTime() : after[k]  ?? ""));
    return [
      changed(["startDatetime", "endDatetime"])                                  && "Date and time",
      changed(["venueAddress", "venueCity", "venuePostcode", "venueMapUrl"])       && "Venue",
      changed(["conferencePlatform"])                                             && "Platform",
      changed(["conferenceUrl"])                                                  && "Join link",
      changed(["conferencePassword"])                                             && "Meeting password",
    ].filter((c): c is string => !!c);
  }

  /** Email everyone booked on the session about a change. Returns how many were emailed. */
  private static async notifySessionUpdate(session: CourseSession, changes: string[]): Promise<number> {
    const recipients = await db
      .select({ email: users.email, studentName: users.name, courseTitle: courses.title })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.sessionId, session.id));
    if (!recipients.length) return 0;

    const tz   = "Europe/London";
    const day  = new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: tz }).format(session.startDatetime);
    const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: tz }).format(d);
    const sameDay = session.startDatetime.toDateString() === session.endDatetime.toDateString();
    const dateTime = sameDay
      ? `${day}, ${time(session.startDatetime)} – ${time(session.endDatetime)}`
      : `${day}, ${time(session.startDatetime)} – ${new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: tz }).format(session.endDatetime)}`;
    const venue = [session.venueAddress, [session.venueCity, session.venuePostcode].filter(Boolean).join(", ")]
      .filter(Boolean).join(", ") || undefined;
    const PLATFORMS: Record<string, string> = {
      zoom: "Zoom", teams: "Microsoft Teams", google_meet: "Google Meet", webex: "Cisco Webex", other: "Video call",
    };

    await Promise.all(recipients.map((r) => EmailService.sessionUpdated(r.email, {
      studentName:        r.studentName ?? "there",
      courseTitle:        r.courseTitle,
      sessionTitle:       session.title,
      changes,
      dateTime,
      venue,
      venueMapUrl:        session.venueMapUrl ?? undefined,
      conferencePlatform: session.conferencePlatform ? PLATFORMS[session.conferencePlatform] ?? session.conferencePlatform : undefined,
      conferenceUrl:      session.conferenceUrl ?? undefined,
      conferencePassword: session.conferencePassword ?? undefined,
    })));
    log.info("Session update emailed", { sessionId: session.id, recipients: recipients.length, changes });
    return recipients.length;
  }

  private static async notifySessionCancellation(session: CourseSession): Promise<void> {
    const recipients = await db
      .select({ email: users.email, studentName: users.name, courseTitle: courses.title })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.sessionId, session.id));

    const startDate = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Europe/London",
    }).format(session.startDatetime);

    await Promise.all(recipients.map((recipient) => EmailService.sessionCancelled(recipient.email, {
      studentName: recipient.studentName ?? "there",
      courseTitle: recipient.courseTitle,
      sessionTitle: session.title,
      startDate,
    })));
  }

  /** Get waitlist for a session ordered by position. */
  static async getWaitlist(sessionId: string): Promise<WaitlistEntry[]> {
    return db
      .select()
      .from(courseSessionWaitlist)
      .where(eq(courseSessionWaitlist.sessionId, sessionId))
      .orderBy(asc(courseSessionWaitlist.position));
  }

  /** Candidate directory for an administrator managing one session. */
  static async getCandidates(sessionId: string) {
    const [session] = await db
      .select({
        id: courseSessions.id,
        title: courseSessions.title,
        capacity: courseSessions.capacity,
        courseTitle: courses.title,
      })
      .from(courseSessions)
      .innerJoin(courses, eq(courseSessions.courseId, courses.id))
      .where(eq(courseSessions.id, sessionId))
      .limit(1);

    if (!session) return null;

    const candidates = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        enrolledAt: enrollments.enrolledAt,
        progress: enrollments.progress,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(eq(enrollments.sessionId, sessionId))
      .orderBy(asc(users.name), asc(users.email));

    return { session, candidates };
  }

  static async tutorCanManageSession(tutorId: string, sessionId: string): Promise<boolean> {
    const { tutorAssignments } = await import("@/db/schema");
    const [assignment] = await db
      .select({ id: tutorAssignments.id })
      .from(tutorAssignments)
      .innerJoin(courseSessions, eq(tutorAssignments.courseId, courseSessions.courseId))
      .where(and(
        eq(tutorAssignments.tutorId, tutorId),
        eq(tutorAssignments.status, "active"),
        eq(courseSessions.id, sessionId)
      ))
      .limit(1);
    return Boolean(assignment);
  }

  static async getInstructorJoinLink(sessionId: string, userId: string, isAdmin = false): Promise<
    | null
    | { allowed: false; message: string }
    | { allowed: true; url: string }
  > {
    const session = await SessionService.findById(sessionId);
    if (!session) return null;
    if (!isAdmin && !(await SessionService.tutorCanManageSession(userId, sessionId))) {
      return { allowed: false, message: "You are not assigned to this session" };
    }
    if (!session.conferenceUrl) return { allowed: false, message: "This session has no online meeting link" };

    const now = Date.now();
    const opensAt = session.startDatetime.getTime() - 20 * 60 * 1000;
    if (now < opensAt) return { allowed: false, message: "The join link opens 20 minutes before the session starts" };
    if (now > session.endDatetime.getTime()) return { allowed: false, message: "This session has ended" };
    return { allowed: true, url: session.conferenceUrl };
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
   * Student calendar page — every session for courses the student is enrolled in.
   */
  static async getStudentSessions(studentId: string) {
    const { enrollments, courseSessions, courses } = await import("@/db/schema");
    const { eq, asc, and, or } = await import("drizzle-orm");

    return db
      .select({
        sessionId:          courseSessions.id,
        courseId:           courseSessions.courseId,
        courseTitle:        courses.title,
        title:              courseSessions.title,
        startDatetime:      courseSessions.startDatetime,
        endDatetime:        courseSessions.endDatetime,
        status:             courseSessions.status,
        conferencePlatform: courseSessions.conferencePlatform,
        conferenceUrl:      courseSessions.conferenceUrl,
        conferencePassword: courseSessions.conferencePassword,
        venueAddress:       courseSessions.venueAddress,
        venueCity:          courseSessions.venueCity,
        venuePostcode:      courseSessions.venuePostcode,
        venueMapUrl:        courseSessions.venueMapUrl,
        capacity:           courseSessions.capacity,
        enrolledCount:      courseSessions.enrolledCount,
      })
      .from(courseSessions)
      .innerJoin(courses,     eq(courseSessions.courseId, courses.id))
      .innerJoin(enrollments, eq(enrollments.courseId,    courses.id))
      .where(and(
        eq(enrollments.studentId, studentId),
        // Unpublished sessions stay hidden — unless it's the one this student is booked on
        or(eq(courseSessions.isPublished, true), eq(enrollments.sessionId, courseSessions.id)),
      ))
      .orderBy(asc(courseSessions.startDatetime));
  }

  /**
   * Instructor sessions page — all sessions for a tutor's assigned courses.
   */
  static async getInstructorSessions(tutorId: string) {
    const { tutorAssignments, courseSessions, courses } = await import("@/db/schema");
    const { eq, and, asc, inArray } = await import("drizzle-orm");

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
        conferenceUrl:    sql<string | null>`CASE
          WHEN ${courseSessions.startDatetime} <= NOW() + INTERVAL '20 minutes'
           AND ${courseSessions.endDatetime} >= NOW()
          THEN ${courseSessions.conferenceUrl}
          ELSE NULL
        END`,
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

export type InstructorSession = Awaited<ReturnType<typeof SessionService.getInstructorSessions>>[number];
