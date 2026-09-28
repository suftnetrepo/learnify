"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AnnouncementItem {
  id:        string;
  courseId:  string;
  tutorId:   string;
  tutorName: string;
  content:   string;
  createdAt: string;
}

export interface GroupMessageItem {
  id:         string;
  courseId:   string;
  sessionId:  string | null;
  senderId:   string;
  senderName: string;
  senderRole: "student" | "tutor" | "admin";
  content:    string;
  createdAt:  string;
}

export class FeedError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

const time = (iso: string) => new Date(iso).getTime();

/** Merge by id (streams re-send a small overlap window) and sort by time. */
function mergeById<T extends { id: string; createdAt: string }>(current: T[], incoming: T[], newestFirst: boolean): T[] {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => (newestFirst ? time(b.createdAt) - time(a.createdAt) : time(a.createdAt) - time(b.createdAt)));
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res  = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new FeedError(data.message || "Message not sent", res.status);
  return data.data as T;
}

const seenKey = (courseId: string) => `learnify:announcements-seen:${courseId}`;

/**
 * Course announcements, newest first, kept live over SSE. Unread = announcements by someone else
 * newer than the last one this browser has seen (remembered per course in localStorage, and
 * compared with server timestamps so a wrong device clock doesn't matter).
 * `isViewing()` says whether the list is on screen right now — then new ones count as seen.
 */
export function useAnnouncements(courseId: string, viewerId: string, isViewing: () => boolean) {
  const [items,    setItems]    = useState<AnnouncementItem[]>([]);
  const [loaded,   setLoaded]   = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const viewingRef = useRef(isViewing);
  useEffect(() => { viewingRef.current = isViewing; }, [isViewing]);

  const remember = useCallback((createdAt: string | undefined) => {
    if (!createdAt) return;
    setLastSeen((prev) => (prev && time(prev) >= time(createdAt) ? prev : createdAt));
    try { localStorage.setItem(seenKey(courseId), createdAt); } catch { /* storage unavailable */ }
  }, [courseId]);

  const load = useCallback(async () => {
    const res  = await fetch(`/api/announcements?courseId=${courseId}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return;
    const list: AnnouncementItem[] = body.data;
    let stored: string | null = null;
    try { stored = localStorage.getItem(seenKey(courseId)); } catch { /* storage unavailable */ }
    setLastSeen((prev) => prev ?? stored ?? new Date(0).toISOString());
    setItems((prev) => mergeById(prev, list, true));
    setLoaded(true);
    if (viewingRef.current()) remember(list[0]?.createdAt);
  }, [courseId, remember]);

  useEffect(() => {
    const es = new EventSource(`/api/announcements/stream?courseId=${courseId}`);
    es.addEventListener("connected", () => { void load(); });
    es.addEventListener("announcement", (e) => {
      const a: AnnouncementItem = JSON.parse((e as MessageEvent).data);
      setItems((prev) => mergeById(prev, [a], true));
      if (viewingRef.current()) remember(a.createdAt);
    });
    return () => es.close();
  }, [courseId, load, remember]);

  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  /** Everything currently listed counts as seen. */
  const markSeen = useCallback(() => remember(itemsRef.current[0]?.createdAt), [remember]);

  const post = useCallback(async (content: string) => {
    const a = await postJson<AnnouncementItem>("/api/announcements", { courseId, content });
    setItems((prev) => mergeById(prev, [a], true));
  }, [courseId]);

  const unread = lastSeen === null
    ? 0
    : items.filter((a) => a.tutorId !== viewerId && time(a.createdAt) > time(lastSeen)).length;

  return { items, loaded, unread, markSeen, post };
}

/**
 * Live Q&A for one session, oldest first, kept live over SSE while `sessionId` is set.
 * `onIncoming` fires for new messages from other people.
 */
export function useGroupChat(
  courseId: string,
  sessionId: string | null,
  viewerId: string,
  onIncoming?: (m: GroupMessageItem) => void,
) {
  // Keyed by session so a new session never shows the previous one's messages
  const [state,  setState]  = useState<{ sessionId: string | null; items: GroupMessageItem[] }>({ sessionId: null, items: [] });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const seen        = useRef(new Set<string>());
  const incomingRef = useRef(onIncoming);
  useEffect(() => { incomingRef.current = onIncoming; }, [onIncoming]);

  const add = useCallback((sid: string, incoming: GroupMessageItem[]) => {
    setState((prev) => ({
      sessionId: sid,
      items: mergeById(prev.sessionId === sid ? prev.items : [], incoming, false),
    }));
  }, []);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const res  = await fetch(`/api/group-messages?courseId=${courseId}&sessionId=${sessionId}`, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return;
    const list: GroupMessageItem[] = body.data;
    list.forEach((m) => seen.current.add(m.id));
    add(sessionId, list);
    setLoadedFor(sessionId);
  }, [courseId, sessionId, add]);

  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`/api/group-messages/stream?courseId=${courseId}&sessionId=${sessionId}`);
    es.addEventListener("connected", () => { void load(); });
    es.addEventListener("group_message", (e) => {
      const m: GroupMessageItem = JSON.parse((e as MessageEvent).data);
      const isNew = !seen.current.has(m.id);
      seen.current.add(m.id);
      add(sessionId, [m]);
      if (isNew && m.senderId !== viewerId) incomingRef.current?.(m);
    });
    return () => es.close();
  }, [courseId, sessionId, viewerId, load, add]);

  const send = useCallback(async (content: string) => {
    if (!sessionId) throw new FeedError("There's no live session right now", 409);
    const m = await postJson<GroupMessageItem>("/api/group-messages", { courseId, sessionId, content });
    seen.current.add(m.id);
    add(sessionId, [m]);
  }, [courseId, sessionId, add]);

  return {
    messages: state.sessionId === sessionId ? state.items : [],
    loaded:   loadedFor === sessionId,
    send,
  };
}
