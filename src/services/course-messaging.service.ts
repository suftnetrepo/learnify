import { and, asc, count, desc, eq, gt, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements, courseSessions, courses, enrollments, groupMessages, staffChannelReads, staffMessages,
  tutorAssignments, users,
  type Announcement, type GroupMessage, type StaffMessage,
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

/** Names of a course's active tutors — shown so admins can see who a staff message reaches. */
const tutorNamesSql = sql<string[]>`array(
  select coalesce(u.name, u.email) from ${tutorAssignments} ta
  join ${users} u on u.id = ta.tutor_id
  where ta.course_id = "courses"."id" and ta.status = 'active'
  order by 1
)`;   // "courses"."id" spelled out: Drizzle leaves columns unqualified in single-table selects

/** Course-wide messaging: tutor announcements, the live-session group chat (Live Q&A) and the staff channel. */
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

  // ─── Staff channel (course tutors ↔ admins) ─────────────────────────────────

  async staffMessages(courseId: string, limit = 300): Promise<StaffMessage[]> {
    const rows = await db
      .select()
      .from(staffMessages)
      .where(eq(staffMessages.courseId, courseId))
      .orderBy(desc(staffMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  },

  async staffMessagesSince(courseId: string, since: Date): Promise<StaffMessage[]> {
    return db
      .select()
      .from(staffMessages)
      .where(and(eq(staffMessages.courseId, courseId), gte(staffMessages.createdAt, since)))
      .orderBy(asc(staffMessages.createdAt));
  },

  /** Assigned tutors and admins only — callers check that with courseRole first. */
  async sendStaffMessage(viewer: Viewer, courseId: string, raw: string): Promise<StaffMessage> {
    const content = cleanContent(raw);
    const role = await this.courseRole(viewer, courseId);
    if (role !== "tutor" && role !== "admin") throw new MessagingError("Only the course's tutors and admins can use the staff channel", 403);
    const [row] = await db
      .insert(staffMessages)
      .values({
        courseId,
        senderId:   viewer.id,
        senderName: await this.displayName(viewer.id, role === "admin" ? "Admin" : "Tutor"),
        senderRole: role,
        content,
      })
      .returning();
    // Sending means you've read everything up to your own message
    await this.markStaffRead(viewer, courseId);
    notifyChannel(channels.staff(courseId));
    return row;
  },

  /** Staff messages from others since the viewer last read the channel. */
  async staffUnread(viewer: Viewer, courseId: string): Promise<number> {
    const [read] = await db
      .select({ lastReadAt: staffChannelReads.lastReadAt })
      .from(staffChannelReads)
      .where(and(eq(staffChannelReads.courseId, courseId), eq(staffChannelReads.userId, viewer.id)))
      .limit(1);
    const [row] = await db
      .select({ n: count() })
      .from(staffMessages)
      .where(and(
        eq(staffMessages.courseId, courseId),
        ne(staffMessages.senderId, viewer.id),
        ...(read ? [gt(staffMessages.createdAt, read.lastReadAt)] : []),
      ));
    return Number(row?.n ?? 0);
  },

  async markStaffRead(viewer: Viewer, courseId: string): Promise<void> {
    // Database clock on both sides of the comparison (messages default to now() too)
    await db
      .insert(staffChannelReads)
      .values({ courseId, userId: viewer.id, lastReadAt: sql`now()` })
      .onConflictDoUpdate({
        target: [staffChannelReads.courseId, staffChannelReads.userId],
        set:    { lastReadAt: sql`now()` },
      });
  },

  /**
   * Staff channels the viewer can use, with the last message and their unread count.
   * Tutors: every course they're assigned to. Admins: courses whose channel has messages.
   */
  async staffChannels(viewer: Viewer) {
    let courseIds: string[] | null = null;
    if (viewer.role === "tutor") {
      const rows = await db
        .select({ courseId: tutorAssignments.courseId })
        .from(tutorAssignments)
        .where(and(eq(tutorAssignments.tutorId, viewer.id), eq(tutorAssignments.status, "active")));
      courseIds = rows.map((r) => r.courseId);
      if (courseIds.length === 0) return [];
    } else if (viewer.role !== "admin") {
      return [];
    }

    const last = db
      .selectDistinctOn([staffMessages.courseId], {
        courseId:   staffMessages.courseId,
        content:    staffMessages.content,
        senderName: staffMessages.senderName,
        createdAt:  staffMessages.createdAt,
      })
      .from(staffMessages)
      .orderBy(staffMessages.courseId, desc(staffMessages.createdAt))
      .as("last_staff");

    const unread = sql<number>`(
      select count(*)::int from ${staffMessages} sm
      where sm.course_id = ${courses.id}
        and sm.sender_id <> ${viewer.id}
        and sm.created_at > coalesce(
          (select r.last_read_at from ${staffChannelReads} r where r.course_id = ${courses.id} and r.user_id = ${viewer.id}),
          'epoch'::timestamp)
    )`;

    const base = db
      .select({
        courseId:      courses.id,
        courseTitle:   courses.title,
        courseStatus:  courses.status,
        tutorNames:    tutorNamesSql,
        lastMessage:   last.content,
        lastSender:    last.senderName,
        lastMessageAt: last.createdAt,
        unreadCount:   unread,
      })
      .from(courses);
    const rows = courseIds
      ? await base.leftJoin(last, eq(last.courseId, courses.id)).where(inArray(courses.id, courseIds))
      : await base.innerJoin(last, eq(last.courseId, courses.id));   // admins: channels with messages

    // Most recent activity first; tutors' quiet courses after, alphabetically
    return rows.sort((a, b) =>
      (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0) || a.courseTitle.localeCompare(b.courseTitle));
  },

  async staffUnreadTotal(viewer: Viewer): Promise<number> {
    const rows = await this.staffChannels(viewer);
    return rows.reduce((sum, r) => sum + Number(r.unreadCount ?? 0), 0);
  },

  /**
   * Courses an admin can open a staff channel on: published courses with at least one active
   * tutor. Tutor names are included because course titles aren't unique.
   */
  async staffCourseOptions() {
    return db
      .select({ courseId: courses.id, courseTitle: courses.title, courseStatus: courses.status, tutorNames: tutorNamesSql })
      .from(courses)
      .where(and(
        eq(courses.status, "published"),
        sql`exists (select 1 from ${tutorAssignments} ta where ta.course_id = ${courses.id} and ta.status = 'active')`,
      ))
      .orderBy(courses.title);
  },
};
