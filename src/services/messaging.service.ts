import { and, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  conversations, courses, enrollments, messages, tutorAssignments, users,
  type Conversation, type Message,
} from "@/db/schema";
import { notifyConversationChange } from "@/lib/messaging/notify";

export type Role = "student" | "tutor" | "admin";
export interface Viewer { id: string; role: Role }

export const MAX_MESSAGE_LENGTH = 4000;

/** The "other side" of a conversation from the viewer's point of view. */
const isStudentSide = (role: Role) => role === "student";

export class MessagingError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export const MessagingService = {
  /** Course ids a tutor is actively assigned to (any access level). */
  async tutorCourseIds(tutorId: string): Promise<string[]> {
    const rows = await db
      .select({ courseId: tutorAssignments.courseId })
      .from(tutorAssignments)
      .where(and(eq(tutorAssignments.tutorId, tutorId), eq(tutorAssignments.status, "active")));
    return rows.map((r) => r.courseId);
  },

  /** Can `viewer` read this conversation? Students: their own. Tutors: courses they're assigned to. Admins: all. */
  async canRead(viewer: Viewer, conversation: Conversation): Promise<boolean> {
    if (viewer.role === "admin") return true;
    if (viewer.role === "student") return conversation.studentId === viewer.id;
    if (viewer.role === "tutor") return (await this.tutorCourseIds(viewer.id)).includes(conversation.courseId);
    return false;
  },

  /** Admins can read everything but don't take part. */
  async canSend(viewer: Viewer, conversation: Conversation): Promise<boolean> {
    return viewer.role !== "admin" && this.canRead(viewer, conversation);
  },

  async get(conversationId: string): Promise<Conversation | null> {
    const [c] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
    return c ?? null;
  },

  /** Conversation list with the other party, course title and last message preview. */
  async list(viewer: Viewer, courseId?: string) {
    const lastMessage = db
      .selectDistinctOn([messages.conversationId], {
        conversationId: messages.conversationId,
        content:        messages.content,
        senderRole:     messages.senderRole,
        createdAt:      messages.createdAt,
      })
      .from(messages)
      .orderBy(messages.conversationId, desc(messages.createdAt))
      .as("last_message");

    const filters = [];
    if (courseId) filters.push(eq(conversations.courseId, courseId));
    if (viewer.role === "student") filters.push(eq(conversations.studentId, viewer.id));
    if (viewer.role === "tutor") {
      const courseIds = await this.tutorCourseIds(viewer.id);
      if (courseIds.length === 0) return [];
      filters.push(inArray(conversations.courseId, courseIds));
    }

    return db
      .select({
        id:            conversations.id,
        courseId:      conversations.courseId,
        courseTitle:   courses.title,
        studentId:     conversations.studentId,
        studentName:   users.name,
        lastMessageAt: conversations.lastMessageAt,
        unreadCount:   viewer.role === "student" ? conversations.studentUnread : conversations.tutorUnread,
        lastMessage:   lastMessage.content,
        lastSender:    lastMessage.senderRole,
      })
      .from(conversations)
      .innerJoin(courses, eq(courses.id, conversations.courseId))
      .innerJoin(users, eq(users.id, conversations.studentId))
      .leftJoin(lastMessage, eq(lastMessage.conversationId, conversations.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(conversations.lastMessageAt));
  },

  /** Total unread for the viewer's side (tutor inbox badge). Admins are observers: 0. */
  async unreadTotal(viewer: Viewer): Promise<number> {
    if (viewer.role === "admin") return 0;
    const rows = await this.list(viewer);
    return rows.reduce((sum, r) => sum + (r.unreadCount ?? 0), 0);
  },

  /** Messages in a conversation, oldest first (most recent `limit`). */
  async messages(conversationId: string, limit = 200): Promise<Message[]> {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
    return rows.reverse();
  },

  /** Messages created at/after `since` (stream catch-up; the client de-duplicates by id). */
  async messagesSince(conversationId: string, since: Date): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), gte(messages.createdAt, since)))
      .orderBy(messages.createdAt);
  },

  /** Ids + readAt of the viewer's own messages read at/after `since` (read receipts). */
  async readSince(conversationId: string, senderId: string, since: Date) {
    return db
      .select({ id: messages.id, readAt: messages.readAt })
      .from(messages)
      .where(and(
        eq(messages.conversationId, conversationId),
        eq(messages.senderId, senderId),
        gte(messages.readAt, since),
      ));
  },

  /**
   * Send a message. Students pass `courseId` (their conversation is created on first message,
   * enrolment required); tutors pass `conversationId`. Admins can't send.
   */
  async send(viewer: Viewer, input: { courseId?: string; conversationId?: string; content: string }) {
    const content = input.content.trim();
    if (!content) throw new MessagingError("Message cannot be empty", 400);
    if (content.length > MAX_MESSAGE_LENGTH) throw new MessagingError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`, 400);
    if (viewer.role === "admin") throw new MessagingError("Admins can view conversations but not send messages", 403);

    let conversation: Conversation | null = null;
    if (input.conversationId) {
      conversation = await this.get(input.conversationId);
      if (!conversation) throw new MessagingError("Conversation not found", 404);
    } else if (viewer.role === "student" && input.courseId) {
      const [enrolled] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(and(eq(enrollments.studentId, viewer.id), eq(enrollments.courseId, input.courseId)))
        .limit(1);
      if (!enrolled) throw new MessagingError("Enrol in this course to message its tutors", 403);
      // Create or reuse — the unique (course, student) index makes this safe under races
      await db.insert(conversations)
        .values({ courseId: input.courseId, studentId: viewer.id })
        .onConflictDoNothing({ target: [conversations.courseId, conversations.studentId] });
      const [c] = await db.select().from(conversations)
        .where(and(eq(conversations.courseId, input.courseId), eq(conversations.studentId, viewer.id)))
        .limit(1);
      conversation = c ?? null;
    }
    if (!conversation) throw new MessagingError("courseId or conversationId is required", 400);
    if (!(await this.canSend(viewer, conversation))) throw new MessagingError("You can't message in this conversation", 403);

    const now = new Date();
    const fromStudent = isStudentSide(viewer.role);
    const [message] = await db
      .insert(messages)
      .values({ conversationId: conversation.id, senderId: viewer.id, senderRole: viewer.role, content, createdAt: now })
      .returning();

    await db
      .update(conversations)
      .set({
        lastMessageAt: now,
        ...(fromStudent
          ? { tutorUnread:   sql`${conversations.tutorUnread} + 1` }
          : { studentUnread: sql`${conversations.studentUnread} + 1` }),
      })
      .where(eq(conversations.id, conversation.id));

    notifyConversationChange(conversation.id);
    return { message, conversationId: conversation.id };
  },

  /**
   * Mark the other side's messages as read and clear the viewer's unread count.
   * Admins only observe, so their viewing doesn't mark anything read.
   */
  async markRead(viewer: Viewer, conversationId: string): Promise<number> {
    if (viewer.role === "admin") return 0;
    const fromStudent = isStudentSide(viewer.role);
    const updated = await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(
        eq(messages.conversationId, conversationId),
        isNull(messages.readAt),
        fromStudent ? ne(messages.senderRole, "student") : eq(messages.senderRole, "student"),
      ))
      .returning({ id: messages.id });
    await db
      .update(conversations)
      .set(fromStudent ? { studentUnread: 0 } : { tutorUnread: 0 })
      .where(eq(conversations.id, conversationId));
    if (updated.length) notifyConversationChange(conversationId);
    return updated.length;
  },
};
