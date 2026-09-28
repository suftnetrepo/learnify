"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { ArrowLeft, Check, CheckCheck, Eye, Megaphone, MessageCircle, Send, Shield, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { announceDrawerOpen, onOtherDrawerOpen } from "@/lib/drawers";
import { useConversation, type ChatMessage } from "./useConversation";
import { FeedError, useAnnouncements, useGroupChat, useStaffChat } from "./useCourseFeeds";

type Tab  = "announcements" | "live" | "private" | "staff";
type Role = "student" | "tutor" | "admin";

export interface LiveSessionInfo {
  id:            string;
  title:         string;
  startDatetime: string;
  endDatetime:   string;
}

interface Props {
  courseId:      string;
  courseName:    string;
  currentUserId: string;
  currentRole:   Role;
  /** Session live right now (worked out on the server); re-checked while the page is open. */
  liveSession:   LiveSessionInfo | null;
  /** Where the floating button sits — pages stack it above the AI Tutor button. */
  buttonPositionClassName?: string;
}

interface ConversationRow {
  id:            string;
  studentName:   string | null;
  lastMessageAt: string;
  unreadCount:   number;
  lastMessage:   string | null;
  lastSender:    string | null;
}

const LIVE_CHECK_MS   = 30_000;   // notice a session starting/ending without a reload
const LIST_REFRESH_MS = 15_000;   // tutors' private conversation list
const DRAWER_ID       = "messages";

const badge = (n: number) => (n > 9 ? "9+" : String(n));

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const dayLabel = (d: Date) => {
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/**
 * One course messaging drawer (slides in from the right; opening it closes any other drawer):
 *   Notices  — tutor/admin announcements to the whole course (tutors compose here)
 *   Live Q&A — class group chat, open only while a course session is live
 *   Private  — student ↔ course tutors (tutors get a list of their students' threads)
 *   Staff    — tutors ↔ admins for this course (staff only; students never see it)
 */
export function UnifiedMessagingDrawer({
  courseId, courseName, currentUserId, currentRole, liveSession: initialLive,
  buttonPositionClassName = "bottom-6 right-6",
}: Props) {
  const isStudent  = currentRole === "student";
  const isAdmin    = currentRole === "admin";
  const isStaff    = !isStudent;   // tutors + admins: post notices, use the staff channel

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);
  const [tab,  setTab]  = useState<Tab>(initialLive ? "live" : "announcements");
  // What's on screen, readable from stream callbacks without re-subscribing
  const viewing = useRef({ open: false, tab });
  const isViewing = useCallback((t: Tab) => viewing.current.open && viewing.current.tab === t, []);

  // ── Live session (re-checked so Live Q&A opens/closes on time) ──────────────
  const [liveSession, setLiveSession] = useState<LiveSessionInfo | null>(initialLive);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      fetch(`/api/courses/${courseId}/active-session`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          if (cancelled || !body) return;
          const s: LiveSessionInfo | null = body.data.session;
          setLiveSession((prev) => (prev?.id === s?.id ? prev : s));
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) timer = setTimeout(check, LIVE_CHECK_MS); });
    };
    timer = setTimeout(check, LIVE_CHECK_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [courseId]);
  const isLive = !!liveSession;

  // ── Notices ─────────────────────────────────────────────────────────────────
  const notices = useAnnouncements(courseId, currentUserId, useCallback(() => isViewing("announcements"), [isViewing]));

  // ── Live Q&A ────────────────────────────────────────────────────────────────
  const [liveUnread, setLiveUnread] = useState(0);
  const onGroupIncoming = useCallback(() => {
    if (!isViewing("live")) setLiveUnread((n) => n + 1);
  }, [isViewing]);
  const group = useGroupChat(courseId, liveSession?.id ?? null, currentUserId, onGroupIncoming);

  // ── Staff channel ───────────────────────────────────────────────────────────
  const staff = useStaffChat(courseId, isStaff, currentUserId, useCallback(() => isViewing("staff"), [isViewing]));

  // ── Private: a student has one thread; tutors/admins pick from the course's threads ──
  const [studentConvId,  setStudentConvId]  = useState<string | null>(null);
  const [studentUnread,  setStudentUnread]  = useState(0);
  const [rows,           setRows]           = useState<ConversationRow[] | null>(null);
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [refreshTick,    setRefreshTick]    = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/messages?courseId=${courseId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        const list: ConversationRow[] = body.data;
        if (isStudent) {
          if (list[0]) { setStudentConvId(list[0].id); setStudentUnread(list[0].unreadCount ?? 0); }
        } else {
          setRows(list);
        }
      })
      .catch(() => {});
    // Tutors: keep the list fresh (new students, previews, unread counts)
    const timer = isStudent ? undefined : setTimeout(() => setRefreshTick((n) => n + 1), LIST_REFRESH_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [courseId, isStudent, refreshTick]);

  const threadId = isStudent ? studentConvId : selectedId;
  const onPrivateIncoming = useCallback(() => {
    if (isAdmin) return;
    if (isViewing("private")) void fetch(`/api/messages/${threadId}`, { method: "PATCH" });
    else if (isStudent) setStudentUnread((n) => n + 1);
  }, [isAdmin, isStudent, isViewing, threadId]);
  const thread = useConversation(threadId, { live: true, viewerId: currentUserId, onIncoming: onPrivateIncoming });

  const privateUnread = isStudent
    ? studentUnread
    : isAdmin ? 0 : (rows ?? []).reduce((sum, r) => sum + (r.unreadCount ?? 0), 0);
  const totalUnread = notices.unread + liveUnread + privateUnread + staff.unread;

  // ── Opening tabs clears their unread ────────────────────────────────────────
  const show = (nextOpen: boolean, nextTab: Tab) => {
    const wasOpen = viewing.current.open;
    if (nextOpen && !wasOpen) {
      announceDrawerOpen(DRAWER_ID);   // AI Tutor etc. close
      requestAnimationFrame(() => panelRef.current?.focus());   // keyboard / screen-reader users land in the drawer
    }
    if (!nextOpen && wasOpen) triggerRef.current?.focus();      // …and back on the button when it closes
    viewing.current = { open: nextOpen, tab: nextTab };
    setOpen(nextOpen);
    setTab(nextTab);
    if (!nextOpen) return;
    if (nextTab === "announcements") notices.markSeen();
    if (nextTab === "live") setLiveUnread(0);
    if (nextTab === "staff") staff.markRead();
    if (nextTab === "private" && isStudent) {
      setStudentUnread(0);
      if (studentConvId) void thread.markRead();
    }
  };

  const openThread = (id: string) => {
    if (id === selectedId) return;
    thread.reset();
    setSelectedId(id);
    if (!isAdmin) {
      setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, unreadCount: 0 } : r)) ?? prev);
      void fetch(`/api/messages/${id}`, { method: "PATCH" });
    }
  };

  // Only one drawer at a time: another one opening (AI Tutor) closes this
  useEffect(() => onOtherDrawerOpen(DRAWER_ID, () => {
    viewing.current = { ...viewing.current, open: false };
    setOpen(false);
  }), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      viewing.current = { ...viewing.current, open: false };
      setOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => show(false, tab);

  const selectedRow = rows?.find((r) => r.id === selectedId) ?? null;

  return (
    <>
      {/* Floating button */}
      <button
        ref={triggerRef}
        onClick={() => show(!open, tab)}
        aria-expanded={open}
        aria-label={`Course messages${isLive ? ", live session" : ""}${totalUnread ? `, ${totalUnread} unread` : ""}`}
        className={cn(
          "fixed z-40 flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-indigo-700",
          buttonPositionClassName,
        )}
      >
        <MessageCircle size={16} />
        Messages
        {isLive && (
          <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-xs">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            LIVE
          </span>
        )}
        {totalUnread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold">
            {badge(totalUnread)}
          </span>
        )}
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/20" onClick={close} aria-hidden />}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Course messages"
        aria-hidden={!open}
        ref={panelRef}
        tabIndex={-1}
        // Closed: off-screen AND out of the tab order (otherwise Tab walks into the hidden drawer)
        inert={!open}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:w-[420px]",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center gap-3 bg-indigo-700 px-4 py-3 text-white">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Course Messages</p>
            <p className="truncate text-xs text-indigo-200">{courseName}</p>
          </div>
          {isLive && (
            <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-xs font-semibold">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE SESSION
            </span>
          )}
          <button onClick={close} aria-label="Close" className="text-indigo-200 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div role="tablist" className="flex flex-shrink-0 border-b border-gray-200 bg-gray-50">
          <TabButton active={tab === "announcements"} onClick={() => show(true, "announcements")}
            icon={Megaphone} label="Notices" unread={notices.unread} />
          <TabButton active={tab === "live"} onClick={() => show(true, "live")}
            icon={Users} label="Live Q&A" unread={liveUnread} dot={isLive} />
          <TabButton active={tab === "private"} onClick={() => show(true, "private")}
            icon={MessageCircle} label="Private" unread={privateUnread} />
          {isStaff && (
            <TabButton active={tab === "staff"} onClick={() => show(true, "staff")}
              icon={Shield} label="Staff" unread={staff.unread} />
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {/* ── NOTICES: bubbles from tutors/admins, oldest → newest ─────── */}
          {tab === "announcements" && (
            <>
              <MessageList
                loading={!notices.loaded}
                empty={<EmptyState icon={Megaphone} title="No announcements yet"
                  hint={isStaff ? "Type below to notify every student on the course." : "Your tutors' course notices will appear here."} />}
                items={[...notices.items].reverse().map((a, i, all) => ({
                  id: a.id, own: false, tone: "tutor" as const, content: a.content, createdAt: a.createdAt,
                  // Broadcasts sit on the left for everyone; the author's own are marked "(you)"
                  label: i > 0 && all[i - 1].tutorId === a.tutorId
                    ? null
                    : `📢 ${a.tutorName}${a.tutorId === currentUserId ? " (you)" : ""}`,
                }))}
              />
              {isStaff && <Composer key="notices" placeholder="Announce to all students…" onSend={notices.post} />}
            </>
          )}

          {/* ── LIVE Q&A ────────────────────────────────────────────── */}
          {tab === "live" && (!isLive ? (
            <div className="flex-1 bg-gray-50">
              <EmptyState icon={Users} title="No live session right now"
                hint={isStudent
                  ? "Live Q&A opens automatically when a session starts. Use Private to message your tutors any time."
                  : "Live Q&A opens automatically while one of this course's sessions is running."} />
            </div>
          ) : (
            <>
              <p className="flex-shrink-0 truncate border-b border-gray-100 bg-white px-4 py-1.5 text-xs text-gray-500">
                {liveSession.title} · until {new Date(liveSession.endDatetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <MessageList
                loading={!group.loaded}
                empty={<EmptyState icon={Users} title="Session is live" hint={isStudent ? "Ask the class your first question!" : "Questions from the class will appear here."} />}
                items={group.messages.map((m, i) => {
                  const own = m.senderId === currentUserId;
                  const sameSender = i > 0 && group.messages[i - 1].senderId === m.senderId;
                  return {
                    id: m.id, own, content: m.content, createdAt: m.createdAt,
                    tone: m.senderRole === "student" ? "student" as const : "tutor" as const,
                    label: !own && !sameSender ? `${m.senderName}${m.senderRole !== "student" ? " · Tutor" : ""}` : null,
                  };
                })}
              />
              {isAdmin
                ? <ReadOnlyNote text="Admins can view Live Q&A but not post." />
                : <Composer key={liveSession.id} placeholder={isStudent ? "Ask the class…" : "Reply to the class…"}
                    onSend={async (text) => {
                      try { await group.send(text); }
                      catch (e) {
                        if (e instanceof FeedError && e.status === 409) setLiveSession(null);   // session just ended
                        throw e;
                      }
                    }} />}
            </>
          ))}

          {/* ── PRIVATE ─────────────────────────────────────────────── */}
          {tab === "private" && (isStudent ? (
            <>
              <p className="flex-shrink-0 border-b border-gray-100 bg-white px-4 py-1.5 text-xs text-gray-500">
                Only you and the course&apos;s tutors can see these messages.
              </p>
              <MessageList
                loading={!!studentConvId && !thread.loaded}
                empty={<EmptyState icon={MessageCircle} title="Message your tutors privately"
                  hint="They'll reply here — even if you're offline, you'll see it next time." />}
                items={privateItems(thread.messages, currentUserId, () => "Tutor")}
              />
              <Composer placeholder="Message your tutors privately…" onSend={async (text) => {
                const id = await thread.send(text, { courseId });
                if (!studentConvId) setStudentConvId(id);
              }} />
            </>
          ) : selectedRow ? (
            <>
              <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-3 py-2">
                <button onClick={() => { thread.reset(); setSelectedId(null); }} aria-label="Back to conversations"
                  className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
                  <ArrowLeft size={16} />
                </button>
                <Avatar name={selectedRow.studentName} />
                <p className="truncate text-sm font-semibold text-gray-800">{selectedRow.studentName ?? "Student"}</p>
              </div>
              <MessageList
                loading={!thread.loaded}
                empty={<EmptyState icon={MessageCircle} title="No messages yet" />}
                items={privateItems(thread.messages, currentUserId, (m) =>
                  m.senderRole === "student" ? (selectedRow.studentName ?? "Student") : m.senderRole === "admin" ? "Admin" : "Tutor")}
              />
              {isAdmin
                ? <ReadOnlyNote text="Admins can view conversations but not reply." />
                : <Composer key={selectedRow.id} placeholder="Reply privately…" onSend={async (text) => { await thread.send(text); }} />}
            </>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {rows === null ? (
                <p className="p-6 text-center text-sm text-gray-400">Loading…</p>
              ) : rows.length === 0 ? (
                <EmptyState icon={MessageCircle} title="No private messages yet"
                  hint="Students on this course can message you privately — their threads appear here." />
              ) : rows.map((r) => (
                <button key={r.id} onClick={() => openThread(r.id)}
                  className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50">
                  <Avatar name={r.studentName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{r.studentName ?? "Student"}</p>
                      <span className={cn("flex-shrink-0 text-[11px]", r.unreadCount && !isAdmin ? "font-semibold text-indigo-600" : "text-gray-400")}>
                        {timeAgo(r.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-gray-500">
                        {r.lastSender && r.lastSender !== "student" && <span className="text-gray-400">Tutor: </span>}
                        {r.lastMessage ?? ""}
                      </p>
                      {!isAdmin && r.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                          {badge(r.unreadCount)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}

          {/* ── STAFF: course tutors ↔ admins ───────────────────────── */}
          {tab === "staff" && isStaff && (
            <>
              <p className="flex-shrink-0 border-b border-gray-100 bg-white px-4 py-1.5 text-xs text-gray-500">
                Only this course&apos;s tutors and admins can see this channel.
              </p>
              <MessageList
                loading={!staff.loaded}
                empty={<EmptyState icon={Shield} title="Staff channel for this course" hint="Private between tutors and admins." />}
                items={staff.messages.map((m, i) => {
                  const own = m.senderId === currentUserId;
                  return {
                    id: m.id, own, content: m.content, createdAt: m.createdAt,
                    tone: m.senderRole,
                    // Names on every sender change, own included, so it's clear who said what
                    label: i > 0 && staff.messages[i - 1].senderId === m.senderId
                      ? null
                      : `${m.senderRole === "admin" ? "🛡️" : "👨‍🏫"} ${m.senderName}${own ? " (you)" : ""}`,
                  };
                })}
              />
              <Composer key="staff" placeholder={isAdmin ? "Message the course tutors…" : "Message the admin team…"} onSend={staff.send} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

interface ListItem {
  id:        string;
  own:       boolean;
  /** Who it's from: tutors highlighted indigo, admins purple. */
  tone:      "student" | "tutor" | "admin";
  label:     string | null;
  content:   string;
  createdAt: string;
  /** Own private messages: null = sent, string = read. Undefined = no ticks. */
  readAt?:   string | null;
}

function privateItems(messages: ChatMessage[], viewerId: string, labelFor: (m: ChatMessage) => string): ListItem[] {
  return messages.map((m, i) => {
    const own = m.senderId === viewerId;
    const sameSender = i > 0 && messages[i - 1].senderId === m.senderId;
    return {
      id: m.id, own, content: m.content, createdAt: m.createdAt,
      tone: m.senderRole,
      label: !own && !sameSender ? labelFor(m) : null,
      readAt: own ? m.readAt : undefined,
    };
  });
}

function TabButton({ active, onClick, icon: Icon, label, unread, dot }: {
  active: boolean; onClick: () => void; icon: ComponentType<{ size?: number }>;
  label: string; unread: number; dot?: boolean;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 border-b-2 px-1 py-2 text-xs font-semibold transition-colors",
        active ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700",
      )}
    >
      <span className="relative">
        <Icon size={16} />
        {unread > 0 ? (
          <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
            {badge(unread)}
          </span>
        ) : dot ? (
          <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-red-500" />
        ) : null}
      </span>
      {label}
    </button>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: ComponentType<{ size?: number; className?: string }>; title: string; hint?: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 py-8 text-center">
      <Icon size={32} className="mb-2 text-gray-300" />
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function Avatar({ name }: { name: string | null }) {
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
      {(name ?? "S").trim()[0]?.toUpperCase() ?? "S"}
    </div>
  );
}

function ReadOnlyNote({ text }: { text: string }) {
  return (
    <div className="flex flex-shrink-0 items-center justify-center gap-2 border-t border-gray-200 bg-white px-4 py-3 text-xs text-gray-500">
      <Eye size={14} /> Read-only — {text}
    </div>
  );
}

/** Chat thread: day separators, bubbles (tutors highlighted), time, and read ticks on own private messages. */
function MessageList({ items, loading, empty }: { items: ListItem[]; loading: boolean; empty: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Keep the newest message in view (scroll the list only, never the page behind)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-50 px-4 py-3">
      {items.length === 0 ? (
        loading ? <p className="py-10 text-center text-sm text-gray-400">Loading…</p> : empty
      ) : items.map((m, i) => {
        const date = new Date(m.createdAt);
        const newDay = i === 0 || new Date(items[i - 1].createdAt).toDateString() !== date.toDateString();
        return (
          <div key={m.id}>
            {newDay && (
              <div className="my-2 flex justify-center">
                <span className="rounded-full bg-white px-3 py-1 text-[11px] text-gray-500 shadow-sm">{dayLabel(date)}</span>
              </div>
            )}
            {m.label && (
              <p className={cn("mb-0.5 mt-2 px-1 text-xs font-semibold", m.own && "text-right",
                m.tone === "admin" ? "text-purple-600" : m.tone === "tutor" ? "text-indigo-600" : "text-gray-500")}>
                {m.label}
              </p>
            )}
            <div className={cn("mb-1.5 flex", m.own ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                m.own
                  ? "rounded-tr-none bg-indigo-600 text-white"
                  : m.tone === "admin"
                    ? "rounded-tl-none border border-purple-100 bg-purple-50 text-gray-800"
                    : m.tone === "tutor"
                      ? "rounded-tl-none border border-indigo-100 bg-indigo-50 text-gray-800"
                      : "rounded-tl-none border border-gray-100 bg-white text-gray-800",
              )}>
                <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <span className={cn("text-[10px]", m.own ? "text-indigo-200" : "text-gray-400")}>
                    {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {m.own && m.readAt !== undefined && (m.readAt
                    ? <CheckCheck size={13} className="text-sky-300" aria-label="Read" />
                    : <Check size={13} className="text-indigo-300" aria-label="Sent" />)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Message box: Enter sends, Shift+Enter is a new line; keys (except Escape) never reach page shortcuts. */
function Composer({ placeholder, onSend }: { placeholder: string; onSend: (text: string) => Promise<void> }) {
  const [input,   setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function submit() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    setInput("");
    try {
      await onSend(text);
    } catch (e) {
      setInput(text);
      setError(e instanceof Error ? e.message : "Message not sent");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex-shrink-0 border-t border-gray-200 bg-white px-3 py-3">
      {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Escape") e.stopPropagation();   // Escape still closes the drawer
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
          }}
          placeholder={placeholder}
          aria-label="Message"
          rows={1}
          maxLength={4000}
          className="max-h-28 min-h-[40px] flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none focus:border-indigo-400"
        />
        <button
          onClick={() => void submit()}
          disabled={!input.trim() || sending}
          aria-label="Send message"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
