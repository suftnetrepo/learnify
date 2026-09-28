/**
 * Wakes live message streams (SSE) in THIS server process as soon as something changes.
 * Streams also check the database every couple of seconds, so delivery still works when the
 * sender and the reader are on different instances (serverless / several servers) — this just
 * makes it instant when they share one.
 */
type Listener = () => void;

const g = globalThis as unknown as { __learnifyMessageListeners?: Map<string, Set<Listener>> };
const listeners: Map<string, Set<Listener>> = (g.__learnifyMessageListeners ??= new Map());

/** Channel names — one per private conversation, and per course for announcements / live Q&A / staff. */
export const channels = {
  conversation:  (conversationId: string) => `conversation:${conversationId}`,
  announcements: (courseId: string)       => `announcements:${courseId}`,
  groupChat:     (courseId: string)       => `group:${courseId}`,
  staff:         (courseId: string)       => `staff:${courseId}`,
};

export function onChannel(channel: string, listener: Listener): () => void {
  let set = listeners.get(channel);
  if (!set) listeners.set(channel, (set = new Set()));
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(channel);
  };
}

export function notifyChannel(channel: string): void {
  listeners.get(channel)?.forEach((listener: Listener) => {
    try { listener(); } catch { /* a closed stream — it unsubscribes itself */ }
  });
}

export const onConversationChange = (conversationId: string, listener: Listener) =>
  onChannel(channels.conversation(conversationId), listener);

export const notifyConversationChange = (conversationId: string) =>
  notifyChannel(channels.conversation(conversationId));
