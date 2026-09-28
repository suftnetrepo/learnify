/**
 * Wakes live message streams (SSE) in THIS server process as soon as something changes.
 * Streams also check the database every couple of seconds, so delivery still works when the
 * sender and the reader are on different instances (serverless / several servers) — this just
 * makes it instant when they share one.
 */
type Listener = () => void;

const g = globalThis as unknown as { __learnifyMessageListeners?: Map<string, Set<Listener>> };
const listeners: Map<string, Set<Listener>> = (g.__learnifyMessageListeners ??= new Map());

export function onConversationChange(conversationId: string, listener: Listener): () => void {
  let set = listeners.get(conversationId);
  if (!set) listeners.set(conversationId, (set = new Set()));
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(conversationId);
  };
}

export function notifyConversationChange(conversationId: string): void {
  listeners.get(conversationId)?.forEach((listener: Listener) => {
    try { listener(); } catch { /* a closed stream — it unsubscribes itself */ }
  });
}
