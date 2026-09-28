import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { directMessages, directThreads, users, type DirectMessage, type DirectThread } from "@/db/schema";
import { channels, notifyChannel } from "@/lib/messaging/notify";
import { MAX_MESSAGE_LENGTH, MessagingError, type Viewer } from "./messaging.service";

/**
 * Tutor ↔ admin team direct chat, not tied to a course. One thread per tutor: the tutor sees
 * their own thread, every admin sees all of them. Either side can start it; students can't use it.
 */
export const DirectMessagingService = {
  async get(threadId: string): Promise<DirectThread | null> {
    const [t] = await db.select().from(directThreads).where(eq(directThreads.id, threadId)).limit(1);
    return t ?? null;
  },

  canRead(viewer: Viewer, thread: DirectThread): boolean {
    if (viewer.role === "admin") return true;
    return viewer.role === "tutor" && thread.tutorId === viewer.id;
  },

  /** Threads with the tutor's name and the last message (admins: all; tutors: their own). */
  async list(viewer: Viewer) {
    if (viewer.role !== "admin" && viewer.role !== "tutor") return [];
    const last = db
      .selectDistinctOn([directMessages.threadId], {
        threadId:   directMessages.threadId,
        content:    directMessages.content,
        senderName: directMessages.senderName,
        senderRole: directMessages.senderRole,
      })
      .from(directMessages)
      .orderBy(directMessages.threadId, desc(directMessages.createdAt))
      .as("last_direct");

    return db
      .select({
        id:            directThreads.id,
        tutorId:       directThreads.tutorId,
        tutorName:     users.name,
        tutorEmail:    users.email,
        lastMessageAt: directThreads.lastMessageAt,
        unreadCount:   viewer.role === "admin" ? directThreads.adminUnread : directThreads.tutorUnread,
        lastMessage:   last.content,
        lastSender:    last.senderName,
        lastRole:      last.senderRole,
      })
      .from(directThreads)
      .innerJoin(users, eq(users.id, directThreads.tutorId))
      .leftJoin(last, eq(last.threadId, directThreads.id))
      .where(viewer.role === "tutor" ? eq(directThreads.tutorId, viewer.id) : undefined)
      .orderBy(desc(directThreads.lastMessageAt));
  },

  async unreadTotal(viewer: Viewer): Promise<number> {
    const rows = await this.list(viewer);
    return rows.reduce((sum, r) => sum + (r.unreadCount ?? 0), 0);
  },

  /** Tutors an admin can start a chat with (active or pending accounts). */
  async tutors() {
    return db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.role, "tutor"), sql`${users.status} in ('active', 'pending')`))
      .orderBy(asc(users.name));
  },

  async messages(threadId: string, limit = 200): Promise<DirectMessage[]> {
    const rows = await db
      .select()
      .from(directMessages)
      .where(eq(directMessages.threadId, threadId))
      .orderBy(desc(directMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  },

  async messagesSince(threadId: string, since: Date): Promise<DirectMessage[]> {
    return db
      .select()
      .from(directMessages)
      .where(and(eq(directMessages.threadId, threadId), gte(directMessages.createdAt, since)))
      .orderBy(asc(directMessages.createdAt));
  },

  /** The viewer's own messages read at/after `since` (read receipts). */
  async readSince(threadId: string, senderId: string, since: Date) {
    return db
      .select({ id: directMessages.id, readAt: directMessages.readAt })
      .from(directMessages)
      .where(and(
        eq(directMessages.threadId, threadId),
        eq(directMessages.senderId, senderId),
        gte(directMessages.readAt, since),
      ));
  },

  /** Find or create a tutor's thread (the unique index makes this safe under races). */
  async threadFor(tutorId: string): Promise<DirectThread> {
    await db.insert(directThreads).values({ tutorId }).onConflictDoNothing({ target: directThreads.tutorId });
    const [t] = await db.select().from(directThreads).where(eq(directThreads.tutorId, tutorId)).limit(1);
    return t;
  },

  /**
   * Send. Tutors always write in their own thread (created on first message). Admins pass
   * `conversationId` for an existing thread or `tutorId` to start one.
   */
  async send(viewer: Viewer, input: { conversationId?: string; tutorId?: string; content: string }) {
    const content = input.content.trim();
    if (!content) throw new MessagingError("Message cannot be empty", 400);
    if (content.length > MAX_MESSAGE_LENGTH) throw new MessagingError(`Message is too long (max ${MAX_MESSAGE_LENGTH} characters)`, 400);
    if (viewer.role !== "admin" && viewer.role !== "tutor") throw new MessagingError("Only tutors and admins can use direct messages", 403);

    let thread: DirectThread | null;
    if (viewer.role === "tutor") {
      thread = await this.threadFor(viewer.id);
    } else if (input.conversationId) {
      thread = await this.get(input.conversationId);
      if (!thread) throw new MessagingError("Conversation not found", 404);
    } else if (input.tutorId) {
      const [tutor] = await db.select({ role: users.role }).from(users).where(eq(users.id, input.tutorId)).limit(1);
      if (tutor?.role !== "tutor") throw new MessagingError("Tutor not found", 404);
      thread = await this.threadFor(input.tutorId);
    } else {
      throw new MessagingError("conversationId or tutorId is required", 400);
    }
    if (!this.canRead(viewer, thread)) throw new MessagingError("You can't message in this conversation", 403);

    const [sender] = await db.select({ name: users.name }).from(users).where(eq(users.id, viewer.id)).limit(1);
    const now = new Date();
    const [message] = await db
      .insert(directMessages)
      .values({
        threadId:   thread.id,
        senderId:   viewer.id,
        senderName: sender?.name?.trim() || (viewer.role === "admin" ? "Admin" : "Tutor"),
        senderRole: viewer.role,
        content,
        createdAt:  now,
      })
      .returning();

    await db
      .update(directThreads)
      .set({
        lastMessageAt: now,
        ...(viewer.role === "tutor"
          ? { adminUnread: sql`${directThreads.adminUnread} + 1` }
          : { tutorUnread: sql`${directThreads.tutorUnread} + 1` }),
      })
      .where(eq(directThreads.id, thread.id));

    notifyChannel(channels.direct(thread.id));
    return { message, conversationId: thread.id };
  },

  /** Mark the other side's messages read and clear the viewer's side's unread count. */
  async markRead(viewer: Viewer, threadId: string): Promise<number> {
    if (viewer.role !== "admin" && viewer.role !== "tutor") return 0;
    const otherSide = viewer.role === "admin" ? "tutor" : "admin";
    const updated = await db
      .update(directMessages)
      .set({ readAt: new Date() })
      .where(and(
        eq(directMessages.threadId, threadId),
        isNull(directMessages.readAt),
        eq(directMessages.senderRole, otherSide),
      ))
      .returning({ id: directMessages.id });
    await db
      .update(directThreads)
      .set(viewer.role === "admin" ? { adminUnread: 0 } : { tutorUnread: 0 })
      .where(eq(directThreads.id, threadId));
    if (updated.length) notifyChannel(channels.direct(threadId));
    return updated.length;
  },
};
