import { and, asc, desc, eq, gt, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements, courseSessions, enrollments, groupMessages, tutorAssignments, users,
  type Announcement, type GroupMessage,
} from "@/db/schema";
import { channels, notifyChannel } from "@/lib/messaging/notify";
import { MAX_MESSAGE_LENGTH, MessagingError, type Role, type Viewer } from "./messaging.service";

export interface ActiveSession {
  id:            string;
  title:         string;
  startDatetime: Date;
  endDatetime:   Date;
}

function cleanContent(raw: string): string {
  const content = raw.trim();
  if (!content) throw new MessagingError("Message cannot be empty", 400);
  if (content.length > MAX_MESSAGE_LENGTH) throw new MessagingError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`, 400);
  return content;
}

/** Course-wide messaging: tutor announcements and the live-session group chat (Live Q&A). */
export const CourseMessagingService = {
  /**
   * The viewer's part in a course: "student" if enrolled, "tutor" if actively assigned,
   * "admin" for admins (who see everything) — or null when they have no business there.
   */
  async courseRole(viewer: Viewer, courseId: string): Promise<Role | null> {
    if (viewer.role === "admin") return "admin";
    if (viewer.role === "tutor") {
      const [a] = await db
        .select({ id: tutorAssignments.id })
        .from(tutorAssignments)
        .where(and(
          eq(tutorAssignments.tutorId, viewer.id),
          eq(tutorAssignments.courseId, courseId),
          eq(tutorAssignments.status, "active"),
        ))
        .limit(1);
      return a ? "tutor" : null;
    }
    const [e] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, viewer.id), eq(enrollments.courseId, courseId)))
      .limit(1);
    return e ? "student" : null;
  },

  /**
   * The course session happening right now: status "scheduled" and now within
   * [startDatetime, endDatetime). If several overlap, a student gets the one they booked.
   */
  async activeSession(courseId: string, studentId?: string): Promise<ActiveSession | null> {
    const now = new Date();
    const live = await db
      .select({
        id:            courseSessions.id,
        title:         courseSessions.title,
        startDatetime: courseSessions.startDatetime,
        endDatetime:   courseSessions.endDatetime,
      })
      .from(courseSessions)
      .where(and(
        eq(courseSessions.courseId, courseId),
        eq(courseSessions.status, "scheduled"),
        lte(courseSessions.startDatetime, now),
        gt(courseSessions.endDatetime, now),
      ))
      .orderBy(asc(courseSessions.startDatetime));
    if (live.length <= 1 || !studentId) return live[0] ?? null;

    const [booking] = await db
      .select({ sessionId: enrollments.sessionId })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, studentId), eq(enrollments.courseId, courseId)))
      .limit(1);
    return live.find((s) => s.id === booking?.sessionId) ?? live[0];
  },

  async displayName(userId: string, fallback: string): Promise<string> {
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
    return u?.name?.trim() || fallback;
  },

  // ─── Announcements ─────────────────────────────────────────────────────────

  /** Newest first. */
  async announcements(courseId: string, limit = 100): Promise<Announcement[]> {
    return db
      .select()
      .from(announcements)
      .where(eq(announcements.courseId, courseId))
      .orderBy(desc(announcements.createdAt))
      .limit(limit);
  },

  async announcementsSince(courseId: string, since: Date): Promise<Announcement[]> {
    return db
      .select()
      .from(announcements)
      .where(and(eq(announcements.courseId, courseId), gte(announcements.createdAt, since)))
      .orderBy(asc(announcements.createdAt));
  },

  /** Assigned tutors and admins broadcast to everyone on the course. */
  async announce(viewer: Viewer, courseId: string, raw: string): Promise<Announcement> {
    const content = cleanContent(raw);
    const role = await this.courseRole(viewer, courseId);
    if (role !== "tutor" && role !== "admin") {
      throw new MessagingError("Only the course's tutors can post announcements", 403);
    }
    const [row] = await db
      .insert(announcements)
      .values({
        courseId,
        tutorId:   viewer.id,
        tutorName: await this.displayName(viewer.id, role === "admin" ? "Admin" : "Tutor"),
        content,
      })
      .returning();
    notifyChannel(channels.announcements(courseId));
    return row;
  },

  // ─── Live Q&A ──────────────────────────────────────────────────────────────

  /** A session's group messages, oldest first (most recent `limit`). */
  async groupMessages(courseId: string, sessionId: string, limit = 300): Promise<GroupMessage[]> {
    const rows = await db
      .select()
      .from(groupMessages)
      .where(and(eq(groupMessages.courseId, courseId), eq(groupMessages.sessionId, sessionId)))
      .orderBy(desc(groupMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  },

  async groupMessagesSince(courseId: string, sessionId: string, since: Date): Promise<GroupMessage[]> {
    return db
      .select()
      .from(groupMessages)
      .where(and(
        eq(groupMessages.courseId, courseId),
        eq(groupMessages.sessionId, sessionId),
        gte(groupMessages.createdAt, since),
      ))
      .orderBy(asc(groupMessages.createdAt));
  },

  async sessionBelongsToCourse(sessionId: string, courseId: string): Promise<boolean> {
    const [s] = await db
      .select({ id: courseSessions.id })
      .from(courseSessions)
      .where(and(eq(courseSessions.id, sessionId), eq(courseSessions.courseId, courseId)))
      .limit(1);
    return !!s;
  },

  /**
   * Post to the live session's group chat. Only while a session is live; enrolled students and
   * assigned tutors can post, admins only watch. The session is worked out here, not trusted
   * from the client — a stale `sessionId` (the session ended) is refused.
   */
  async sendGroupMessage(viewer: Viewer, courseId: string, raw: string, sessionId?: string): Promise<GroupMessage> {
    const content = cleanContent(raw);
    const role = await this.courseRole(viewer, courseId);
    if (!role) throw new MessagingError("You're not part of this course", 403);
    if (role === "admin") throw new MessagingError("Admins can view Live Q&A but not post", 403);

    const session = await this.activeSession(courseId, role === "student" ? viewer.id : undefined);
    if (!session) throw new MessagingError("There's no live session right now", 409);
    if (sessionId && sessionId !== session.id) throw new MessagingError("That session has ended", 409);

    const [row] = await db
      .insert(groupMessages)
      .values({
        courseId,
        sessionId:  session.id,
        senderId:   viewer.id,
        senderName: await this.displayName(viewer.id, role === "tutor" ? "Tutor" : "Student"),
        senderRole: role,
        content,
      })
      .returning();
    notifyChannel(channels.groupChat(courseId));
    return row;
  },
};
