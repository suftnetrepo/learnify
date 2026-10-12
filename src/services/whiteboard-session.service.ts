import { db } from "@/db";
import {
  whiteboards, whiteboardSessions, whiteboardParticipants,
  courses, courseSessions, enrollments, users, tutorAssignments,
} from "@/db/schema";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { requireCourseAccess } from "@/lib/access/course";

export type ParticipantRole = "host" | "editor" | "viewer";

export interface SessionDetail {
  id:                string;
  whiteboardId:      string;
  hostId:            string;
  status:            "active" | "ended";
  courseSessionId:   string | null;
  startedAt:         Date;
  endedAt:           Date | null;
  whiteboardTitle:   string;
  whiteboardOwnerId: string;
  /** The course from the linked course session, falling back to the whiteboard's own course */
  courseId:          string | null;
  courseTitle:       string | null;
  courseSessionTitle: string | null;
}

export interface ParticipantDetail {
  userId:     string;
  name:       string | null;
  role:       ParticipantRole;
  canEdit:    boolean;
  joinedAt:   Date;
  lastSeenAt: Date;
}

export interface JoinableSession { sessionId: string; whiteboardId: string; title: string; courseTitle: string | null }

export class WhiteboardSessionService {
  // ─── Queries ────────────────────────────────────────────────────────────────

  static async findById(sessionId: string): Promise<SessionDetail | null> {
    const [row] = await db
      .select({
        id:                 whiteboardSessions.id,
        whiteboardId:       whiteboardSessions.whiteboardId,
        hostId:             whiteboardSessions.hostId,
        status:             whiteboardSessions.status,
        courseSessionId:    whiteboardSessions.courseSessionId,
        startedAt:          whiteboardSessions.startedAt,
        endedAt:            whiteboardSessions.endedAt,
        whiteboardTitle:    whiteboards.title,
        whiteboardOwnerId:  whiteboards.ownerId,
        boardCourseId:      whiteboards.courseId,
        sessionCourseId:    courseSessions.courseId,
        courseSessionTitle: courseSessions.title,
      })
      .from(whiteboardSessions)
      .innerJoin(whiteboards, eq(whiteboardSessions.whiteboardId, whiteboards.id))
      .leftJoin(courseSessions, eq(whiteboardSessions.courseSessionId, courseSessions.id))
      .where(and(eq(whiteboardSessions.id, sessionId), eq(whiteboards.isDeleted, false)))
      .limit(1);
    if (!row) return null;

    const courseId = row.sessionCourseId ?? row.boardCourseId;
    const [course] = courseId
      ? await db.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId)).limit(1)
      : [];
    return {
      id:                 row.id,
      whiteboardId:       row.whiteboardId,
      hostId:             row.hostId,
      status:             row.status,
      courseSessionId:    row.courseSessionId,
      startedAt:          row.startedAt,
      endedAt:            row.endedAt,
      whiteboardTitle:    row.whiteboardTitle,
      whiteboardOwnerId:  row.whiteboardOwnerId,
      courseSessionTitle: row.courseSessionTitle,
      courseId,
      courseTitle:        course?.title ?? null,
    };
  }

  static async findActiveForWhiteboard(whiteboardId: string): Promise<SessionDetail | null> {
    const [row] = await db
      .select({ id: whiteboardSessions.id })
      .from(whiteboardSessions)
      .where(and(eq(whiteboardSessions.whiteboardId, whiteboardId), eq(whiteboardSessions.status, "active")))
      .orderBy(desc(whiteboardSessions.startedAt))
      .limit(1);
    return row ? WhiteboardSessionService.findById(row.id) : null;
  }

  /** Active session ids for the given boards (listing page "Join" badges). */
  static async activeSessionIds(whiteboardIds: string[]): Promise<Map<string, string>> {
    if (whiteboardIds.length === 0) return new Map();
    const rows = await db
      .select({ whiteboardId: whiteboardSessions.whiteboardId, id: whiteboardSessions.id })
      .from(whiteboardSessions)
      .where(and(inArray(whiteboardSessions.whiteboardId, whiteboardIds), eq(whiteboardSessions.status, "active")));
    return new Map(rows.map((r) => [r.whiteboardId, r.id]));
  }

  /**
   * Live sessions on other people's boards that this user may join: students via their
   * enrolment (matching cohort), tutors via an active assignment. Admins aren't offered
   * every session platform-wide.
   */
  static async listJoinable(userId: string, role: string): Promise<JoinableSession[]> {
    if (role !== "student" && role !== "tutor") return [];

    const courseIds = role === "tutor"
      ? (await db.select({ id: tutorAssignments.courseId }).from(tutorAssignments)
          .where(and(eq(tutorAssignments.tutorId, userId), eq(tutorAssignments.status, "active")))).map((r) => r.id)
      : (await db.select({ id: enrollments.courseId }).from(enrollments)
          .where(eq(enrollments.studentId, userId))).map((r) => r.id);
    if (courseIds.length === 0) return [];

    const rows = await db
      .select({
        sessionId:       whiteboardSessions.id,
        whiteboardId:    whiteboards.id,
        title:           whiteboards.title,
        courseSessionId: whiteboardSessions.courseSessionId,
        courseId:        sql<string | null>`coalesce(${courseSessions.courseId}, ${whiteboards.courseId})`,
        ownerId:         whiteboards.ownerId,
      })
      .from(whiteboardSessions)
      .innerJoin(whiteboards, eq(whiteboardSessions.whiteboardId, whiteboards.id))
      .leftJoin(courseSessions, eq(whiteboardSessions.courseSessionId, courseSessions.id))
      .where(and(eq(whiteboardSessions.status, "active"), eq(whiteboards.isDeleted, false)))
      .orderBy(desc(whiteboardSessions.startedAt));

    const result: JoinableSession[] = [];
    for (const row of rows) {
      if (row.ownerId === userId || !row.courseId || !courseIds.includes(row.courseId)) continue;
      if (role === "student" && !(await WhiteboardSessionService.isEnrolled(userId, row.courseId, row.courseSessionId))) continue;
      const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, row.courseId)).limit(1);
      result.push({ sessionId: row.sessionId, whiteboardId: row.whiteboardId, title: row.title, courseTitle: course?.title ?? null });
    }
    return result;
  }

  static async listParticipants(sessionId: string): Promise<ParticipantDetail[]> {
    return db
      .select({
        userId:     whiteboardParticipants.userId,
        name:       users.name,
        role:       whiteboardParticipants.role,
        canEdit:    whiteboardParticipants.canEdit,
        joinedAt:   whiteboardParticipants.joinedAt,
        lastSeenAt: whiteboardParticipants.lastSeenAt,
      })
      .from(whiteboardParticipants)
      .innerJoin(users, eq(whiteboardParticipants.userId, users.id))
      .where(eq(whiteboardParticipants.sessionId, sessionId))
      .orderBy(whiteboardParticipants.joinedAt);
  }

  // ─── Access ─────────────────────────────────────────────────────────────────

  /**
   * Enrolled in the course; when a course session is linked, the enrolment must be for that
   * cohort or not tied to one (self-paced/online enrolments have no session).
   */
  static async isEnrolled(userId: string, courseId: string, courseSessionId: string | null): Promise<boolean> {
    const [row] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(
        eq(enrollments.studentId, userId),
        eq(enrollments.courseId, courseId),
        courseSessionId ? or(isNull(enrollments.sessionId), eq(enrollments.sessionId, courseSessionId)) : undefined,
      ))
      .limit(1);
    return !!row;
  }

  /** Can start a session on this board: owner, admin, or a tutor assigned to its course. */
  static async canCreate(board: { ownerId: string; courseId: string | null }, userId: string, role: string, courseId?: string | null): Promise<boolean> {
    if (board.ownerId === userId || role === "admin") return true;
    const target = courseId ?? board.courseId;
    return role === "tutor" && !!target && requireCourseAccess(userId, target, role, "viewer");
  }

  /**
   * The role this user gets in the session, or null if they can't join. Derived from the
   * DB every time — never from anything the client sends.
   */
  static async joinRole(session: SessionDetail, userId: string, role: string): Promise<{ role: ParticipantRole; canEdit: boolean } | null> {
    if (session.hostId === userId)            return { role: "host", canEdit: true };
    if (role === "admin")                     return { role: "editor", canEdit: true };
    if (session.whiteboardOwnerId === userId) return { role: "editor", canEdit: true };
    if (!session.courseId)                    return null;
    if (role === "tutor") {
      return (await requireCourseAccess(userId, session.courseId, role, "viewer")) ? { role: "editor", canEdit: true } : null;
    }
    if (role === "student" && (await WhiteboardSessionService.isEnrolled(userId, session.courseId, session.courseSessionId))) {
      return { role: "viewer", canEdit: false };
    }
    return null;
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Returns the board's active session, creating one (with the host's participant row) if
   * none exists. An advisory lock on the board id stops two hosts racing to create two.
   */
  static async createOrResume(whiteboardId: string, hostId: string, courseSessionId: string | null): Promise<{ sessionId: string; created: boolean }> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${whiteboardId}))`);

      const [active] = await tx
        .select({ id: whiteboardSessions.id })
        .from(whiteboardSessions)
        .where(and(eq(whiteboardSessions.whiteboardId, whiteboardId), eq(whiteboardSessions.status, "active")))
        .limit(1);
      if (active) return { sessionId: active.id, created: false };

      const [session] = await tx
        .insert(whiteboardSessions)
        .values({ whiteboardId, hostId, courseSessionId, status: "active" })
        .returning({ id: whiteboardSessions.id });
      await tx.insert(whiteboardParticipants).values({ sessionId: session.id, userId: hostId, role: "host", canEdit: true });
      return { sessionId: session.id, created: true };
    });
  }

  static async end(sessionId: string): Promise<boolean> {
    const updated = await db
      .update(whiteboardSessions)
      .set({ status: "ended", endedAt: new Date() })
      .where(and(eq(whiteboardSessions.id, sessionId), eq(whiteboardSessions.status, "active")))
      .returning({ id: whiteboardSessions.id });
    return updated.length > 0;
  }

  /**
   * Admits a user: creates their participant row, or refreshes it. A viewer the host has
   * already granted drawing keeps canEdit; roles are re-derived each time.
   */
  static async admit(sessionId: string, userId: string, access: { role: ParticipantRole; canEdit: boolean }): Promise<{ role: ParticipantRole; canEdit: boolean }> {
    const [existing] = await db
      .select({ id: whiteboardParticipants.id, canEdit: whiteboardParticipants.canEdit })
      .from(whiteboardParticipants)
      .where(and(eq(whiteboardParticipants.sessionId, sessionId), eq(whiteboardParticipants.userId, userId)))
      .limit(1);

    const canEdit = access.role === "viewer" ? (existing?.canEdit ?? false) : access.canEdit;
    if (existing) {
      await db
        .update(whiteboardParticipants)
        .set({ role: access.role, canEdit, lastSeenAt: new Date() })
        .where(eq(whiteboardParticipants.id, existing.id));
    } else {
      await db.insert(whiteboardParticipants).values({ sessionId, userId, role: access.role, canEdit });
    }
    return { role: access.role, canEdit };
  }

  /** False if the user isn't a participant or is the host (whose access can't change). */
  static async setCanEdit(sessionId: string, userId: string, canEdit: boolean): Promise<boolean> {
    const updated = await db
      .update(whiteboardParticipants)
      .set({ canEdit })
      .where(and(
        eq(whiteboardParticipants.sessionId, sessionId),
        eq(whiteboardParticipants.userId, userId),
        sql`${whiteboardParticipants.role} <> 'host'`,
      ))
      .returning({ id: whiteboardParticipants.id });
    return updated.length > 0;
  }
}
