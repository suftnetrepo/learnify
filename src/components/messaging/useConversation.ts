"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  id:             string;
  conversationId: string;
  senderId:       string;
  senderRole:     "student" | "tutor" | "admin";
  /** Set on direct / staff messages (snapshot of the sender's name) */
  senderName?:    string;
  content:        string;
  readAt:         string | null;
  createdAt:      string;
}

export interface ConversationMeta {
  id:          string;
  courseId:    string;
  courseTitle: string | null;
  studentId:   string;
  studentName: string | null;
  canSend:     boolean;
}

const byTime = (a: ChatMessage, b: ChatMessage) =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

/** Merge by id (streams re-send a small overlap window), keep chronological order. */
function merge(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, { ...map.get(m.id), ...m });
  return [...map.values()].sort(byTime);
}

/**
 * Live conversation: loads the thread, keeps an SSE connection open while `live`, and applies
 * new messages + read receipts. `onIncoming` fires for messages from the other side.
 * `basePath` picks the API: "/api/messages" (student ↔ tutors) or "/api/direct-messages"
 * (tutor ↔ admin team) — both have the same shape.
 */
export function useConversation(
  conversationId: string | null,
  { live, viewerId, onIncoming, basePath = "/api/messages" }:
    { live: boolean; viewerId: string; onIncoming?: (m: ChatMessage) => void; basePath?: string },
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [meta,     setMeta]     = useState<ConversationMeta | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [loaded,   setLoaded]   = useState(false);   // first load for this conversation done
  const seen       = useRef(new Set<string>());
  const incomingRef = useRef(onIncoming);
  useEffect(() => { incomingRef.current = onIncoming; }, [onIncoming]);

  const load = useCallback(async () => {
    if (!conversationId) return;
    const res  = await fetch(`${basePath}/${conversationId}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.message || "Couldn't load messages"); return; }
    const loaded: ChatMessage[] = body.data.messages;
    loaded.forEach((m) => seen.current.add(m.id));
    setMeta(body.data.conversation);
    setMessages((prev) => merge(prev, loaded));
    setError(null);
    setLoaded(true);
  }, [conversationId, basePath]);

  // Live updates. EventSource reconnects by itself; every (re)connect reloads to catch up.
  useEffect(() => {
    if (!conversationId || !live) return;
    const es = new EventSource(`${basePath}/stream?conversationId=${conversationId}`);
    es.addEventListener("connected", () => { void load(); });
    es.addEventListener("message", (e) => {
      const m: ChatMessage = JSON.parse((e as MessageEvent).data);
      const isNew = !seen.current.has(m.id);
      seen.current.add(m.id);
      setMessages((prev) => merge(prev, [m]));
      if (isNew && m.senderId !== viewerId) incomingRef.current?.(m);
    });
    es.addEventListener("read", (e) => {
      const { ids, readAt } = JSON.parse((e as MessageEvent).data) as { ids: string[]; readAt: string };
      const set = new Set(ids);
      setMessages((prev) => prev.map((m) => (set.has(m.id) ? { ...m, readAt: m.readAt ?? readAt } : m)));
    });
    return () => es.close();
  }, [conversationId, live, viewerId, load, basePath]);

  const markRead = useCallback(async () => {
    if (conversationId) await fetch(`${basePath}/${conversationId}`, { method: "PATCH" }).catch(() => {});
  }, [conversationId, basePath]);

  /**
   * Send; returns the conversation id. With no conversation yet, `start` says where to create it
   * (a student's { courseId }, an admin's { tutorId }; a tutor's direct thread needs nothing).
   */
  const send = useCallback(async (content: string, start?: Record<string, string>): Promise<string> => {
    const res  = await fetch(basePath, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ content, ...(conversationId ? { conversationId } : start) }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Message not sent");
    const sent: ChatMessage = body.data.message;
    seen.current.add(sent.id);
    setMessages((prev) => merge(prev, [sent]));
    return body.data.conversationId as string;
  }, [conversationId, basePath]);

  const reset = useCallback(() => { setMessages([]); setMeta(null); setLoaded(false); seen.current.clear(); }, []);

  return { messages, meta, error, loaded, load, markRead, send, reset };
}
