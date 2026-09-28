"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

export interface StaffMessageItem {
  id:         string;
  courseId:   string;
  senderId:   string;
  senderName: string;
  senderRole: "tutor" | "admin";
  content:    string;
  createdAt:  string;
}

interface FeedMessage { id: string; senderId: string; createdAt: string }

/**
 * A chat feed, oldest first, kept live over SSE while `key` is set: loads `listUrl`, then applies
 * `event` messages from `streamUrl` (reloading on every (re)connect). State is keyed so switching
 * feeds (a new live session) never shows the previous one's messages.
 * `onIncoming` fires for new messages from other people.
 */
function useMessageFeed<T extends FeedMessage>(
  key: string | null,
  urls: { list: string; stream: string; event: string; post: string },
  postBody: Record<string, unknown>,
  viewerId: string,
  onIncoming?: (m: T) => void,
) {
  const [state,     setState]     = useState<{ key: string | null; items: T[] }>({ key: null, items: [] });
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const seen        = useRef(new Set<string>());
  const incomingRef = useRef(onIncoming);
  useEffect(() => { incomingRef.current = onIncoming; }, [onIncoming]);
  const bodyRef = useRef(postBody);
  useEffect(() => { bodyRef.current = postBody; }, [postBody]);
  const { list, stream, event, post } = urls;

  const add = useCallback((k: string, incoming: T[]) => {
    setState((prev) => ({ key: k, items: mergeById(prev.key === k ? prev.items : [], incoming, false) }));
  }, []);

  const load = useCallback(async () => {
    if (!key) return;
    const res  = await fetch(list, { cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return;
    const items: T[] = body.data;
    items.forEach((m) => seen.current.add(m.id));
    add(key, items);
    setLoadedFor(key);
  }, [key, list, add]);

  useEffect(() => {
    if (!key) return;
    const es = new EventSource(stream);
    es.addEventListener("connected", () => { void load(); });
    es.addEventListener(event, (e) => {
      const m: T = JSON.parse((e as MessageEvent).data);
      const isNew = !seen.current.has(m.id);
      seen.current.add(m.id);
      add(key, [m]);
      if (isNew && m.senderId !== viewerId) incomingRef.current?.(m);
    });
    return () => es.close();
  }, [key, stream, event, viewerId, load, add]);

  const send = useCallback(async (content: string) => {
    if (!key) throw new FeedError("This chat isn't available right now", 409);
    const m = await postJson<T>(post, { ...bodyRef.current, content });
    seen.current.add(m.id);
    add(key, [m]);
  }, [key, post, add]);

  return { messages: state.key === key ? state.items : [], loaded: loadedFor === key, send };
}

/** Live Q&A for one session (while `sessionId` is set). */
export function useGroupChat(
  courseId: string,
  sessionId: string | null,
  viewerId: string,
  onIncoming?: (m: GroupMessageItem) => void,
) {
  const qs = `courseId=${courseId}&sessionId=${sessionId}`;
  return useMessageFeed<GroupMessageItem>(
    sessionId,
    { list: `/api/group-messages?${qs}`, stream: `/api/group-messages/stream?${qs}`, event: "group_message", post: "/api/group-messages" },
    { courseId, sessionId },
    viewerId,
    onIncoming,
  );
}

/**
 * The course's staff channel (assigned tutors ↔ admins), when `enabled`. Unread is tracked on the
 * server per person, so a badge follows them to any device; `isViewing()` says the channel is on
 * screen — then new messages are marked read straight away.
 */
export function useStaffChat(courseId: string, enabled: boolean, viewerId: string, isViewing: () => boolean) {
  const [unread, setUnread] = useState(0);
  const viewingRef = useRef(isViewing);
  useEffect(() => { viewingRef.current = isViewing; }, [isViewing]);

  const patchRead = useCallback(() => {
    void fetch(`/api/staff-messages?courseId=${courseId}`, { method: "PATCH" }).catch(() => {});
  }, [courseId]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(`/api/staff-messages?courseId=${courseId}&unread=1`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (!cancelled && body && !viewingRef.current()) setUnread(body.data.unread ?? 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [courseId, enabled]);

  const onIncoming = useCallback(() => {
    if (viewingRef.current()) patchRead();
    else setUnread((n) => n + 1);
  }, [patchRead]);

  const postBody = useMemo(() => ({ courseId }), [courseId]);
  const feed = useMessageFeed<StaffMessageItem>(
    enabled ? courseId : null,
    { list: `/api/staff-messages?courseId=${courseId}`, stream: `/api/staff-messages/stream?courseId=${courseId}`, event: "staff_message", post: "/api/staff-messages" },
    postBody,
    viewerId,
    onIncoming,
  );

  const markRead = useCallback(() => { setUnread(0); patchRead(); }, [patchRead]);

  return { ...feed, unread, markRead };
}
