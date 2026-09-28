import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { courses, users } from "@/db/schema";
import { MessagingService } from "@/services";
import type { Viewer } from "@/services/messaging.service";
import { forbidden, notFound, serverError, successResponse, unauthorized, validationError } from "@/lib/api-response";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ conversationId: string }> };

async function load(conversationId: string, viewer: Viewer) {
  if (!z.string().uuid().safeParse(conversationId).success) return { error: validationError({ conversationId: ["Invalid id"] }) };
  const conversation = await MessagingService.get(conversationId);
  if (!conversation) return { error: notFound("Conversation") };
  if (!(await MessagingService.canRead(viewer, conversation))) return { error: forbidden() };
  return { conversation };
}

/** GET — conversation details + messages (oldest first). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const viewer: Viewer = { id: session.user.id, role: session.user.role };
    const { conversationId } = await params;
    const { conversation, error } = await load(conversationId, viewer);
    if (error) return error;

    const [[student], [course], msgs] = await Promise.all([
      db.select({ name: users.name }).from(users).where(eq(users.id, conversation.studentId)).limit(1),
      db.select({ title: courses.title }).from(courses).where(eq(courses.id, conversation.courseId)).limit(1),
      MessagingService.messages(conversation.id),
    ]);
    return successResponse({
      conversation: {
        id:          conversation.id,
        courseId:    conversation.courseId,
        courseTitle: course?.title ?? null,
        studentId:   conversation.studentId,
        studentName: student?.name ?? null,
        canSend:     await MessagingService.canSend(viewer, conversation),
      },
      messages: msgs,
    });
  } catch (error) {
    log.error("Load conversation failed", { error });
    return serverError();
  }
}

/** PATCH — mark the other side's messages as read (no-op for admins, who only observe). */
export async function PATCH(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const viewer: Viewer = { id: session.user.id, role: session.user.role };
    const { conversationId } = await params;
    const { conversation, error } = await load(conversationId, viewer);
    if (error) return error;
    return successResponse({ marked: await MessagingService.markRead(viewer, conversation.id) });
  } catch (error) {
    log.error("Mark read failed", { error });
    return serverError();
  }
}
