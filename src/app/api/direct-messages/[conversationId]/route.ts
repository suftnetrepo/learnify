import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { DirectMessagingService } from "@/services";
import type { Viewer } from "@/services/messaging.service";
import { forbidden, notFound, serverError, successResponse, unauthorized, validationError } from "@/lib/api-response";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ conversationId: string }> };

async function load(threadId: string, viewer: Viewer) {
  if (!z.string().uuid().safeParse(threadId).success) return { error: validationError({ conversationId: ["Invalid id"] }) };
  const thread = await DirectMessagingService.get(threadId);
  if (!thread) return { error: notFound("Conversation") };
  if (!DirectMessagingService.canRead(viewer, thread)) return { error: forbidden() };
  return { thread };
}

/** GET — thread details + messages (oldest first). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const viewer: Viewer = { id: session.user.id, role: session.user.role };
    const { conversationId } = await params;
    const { thread, error } = await load(conversationId, viewer);
    if (error) return error;
    const [[tutor], msgs] = await Promise.all([
      db.select({ name: users.name }).from(users).where(eq(users.id, thread.tutorId)).limit(1),
      DirectMessagingService.messages(thread.id),
    ]);
    return successResponse({
      conversation: { id: thread.id, tutorId: thread.tutorId, tutorName: tutor?.name ?? null, canSend: true },
      messages: msgs,
    });
  } catch (error) {
    log.error("Load direct thread failed", { error });
    return serverError();
  }
}

/** PATCH — mark the other side's messages as read. */
export async function PATCH(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const viewer: Viewer = { id: session.user.id, role: session.user.role };
    const { conversationId } = await params;
    const { thread, error } = await load(conversationId, viewer);
    if (error) return error;
    return successResponse({ marked: await DirectMessagingService.markRead(viewer, thread.id) });
  } catch (error) {
    log.error("Mark direct thread read failed", { error });
    return serverError();
  }
}
