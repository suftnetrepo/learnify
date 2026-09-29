"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, GraduationCap, MessageCircle, Plus, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { avatarColor, avatarColors, initials } from "@/lib/avatar";
import { ConversationView } from "./ConversationView";
import { MessagesInbox } from "./MessagesInbox";
import { useConversation, type ChatMessage } from "./useConversation";
import { useStaffChat } from "./useCourseFeeds";

type Role   = "tutor" | "admin";
export type HubTab = "students" | "direct" | "staff";

const LIST_REFRESH_MS   = 10_000;
const UNREAD_REFRESH_MS = 15_000;
/** Fired when messages are read here, so the sidebar badge updates without waiting for its poll. */
export const UNREAD_CHANGED_EVENT = "learnify:unread-changed";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Load a list and refresh it every few seconds while mounted. `reload()` refreshes now. */
function usePolledList<T>(url: string) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (!cancelled && body) setRows(body.data); })
      .catch(() => {});
    const timer = setTimeout(() => setTick((n) => n + 1), LIST_REFRESH_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [url, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { rows, setRows, reload };
}

/**
 * Messages page for staff. Tabs:
 *   Students / Student conversations — private student ↔ tutor threads (admins read-only)
 *   Admin team / Tutors              — direct tutor ↔ admin chat, not tied to a course
 *   Course staff                     — each course's tutors ↔ admins channel
 */
export function MessagesHub({ viewerId, viewerRole, initialTab }: { viewerId: string; viewerRole: Role; initialTab?: HubTab }) {
  const tabs: { id: HubTab; label: string; icon: typeof Users }[] = viewerRole === "admin"
    ? [
        { id: "direct",   label: "Tutors",                icon: GraduationCap },
        { id: "staff",    label: "Course staff",          icon: Shield },
        { id: "students", label: "Student conversations", icon: MessageCircle },
      ]
    : [
        { id: "students", label: "Students",     icon: MessageCircle },
        { id: "direct",   label: "Admin team",   icon: Users },
        { id: "staff",    label: "Course staff", icon: Shield },
      ];
  const [tab, setTab] = useState<HubTab>(initialTab && tabs.some((t) => t.id === initialTab) ? initialTab : tabs[0].id);

  // Per-tab unread badges
  const [unread, setUnread] = useState<{ students: number; direct: number; staff: number }>({ students: 0, direct: 0, staff: 0 });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/messages?unread=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        const d = body.data;
        setUnread({ students: d.students ?? 0, direct: d.direct ?? 0, staff: d.staff ?? 0 });
      })
      .catch(() => {});
    const timer = setTimeout(() => setTick((n) => n + 1), UNREAD_REFRESH_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [tick]);
  const refreshUnread = useCallback(() => {
    setTick((n) => n + 1);
    window.dispatchEvent(new Event(UNREAD_CHANGED_EVENT));   // sidebar badge refreshes too
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col bg-white">
      <div role="tablist" className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-surface-100 px-4 pt-3">
        {tabs.map(({ id, label, icon: Icon }) => {
          // Admins only observe student conversations, so no badge there
          const count = id === "students" && viewerRole === "admin" ? 0 : unread[id];
          return (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => { setTab(id); refreshUnread(); }}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                tab === id ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-800",
              )}
            >
              <Icon size={16} />
              {label}
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Only the visible tab is mounted, so only its live connections are open */}
      <div className="min-h-0 flex-1">
        {tab === "students" && (
          <MessagesInbox viewerId={viewerId} viewerRole={viewerRole}
            title={viewerRole === "admin" ? "Student conversations" : "Students"} />
        )}
        {tab === "direct" && <DirectPane viewerId={viewerId} viewerRole={viewerRole} onRead={refreshUnread} />}
        {tab === "staff" && <StaffPane viewerId={viewerId} viewerRole={viewerRole} onRead={refreshUnread} />}
      </div>
    </div>
  );
}

// ─── Layout pieces ────────────────────────────────────────────────────────────

function SplitView({ list, thread, showThread }: { list: React.ReactNode; thread: React.ReactNode; showThread: boolean }) {
  return (
    <div className="flex h-full min-h-0">
      <aside className={cn("flex w-full flex-col border-r border-surface-100 md:w-[340px] md:flex-shrink-0", showThread && "hidden md:flex")}>
        {list}
      </aside>
      <section className={cn("min-w-0 flex-1 flex-col", showThread ? "flex" : "hidden md:flex")}>{thread}</section>
    </div>
  );
}

function ListHeader({ title, hint, action }: { title: string; hint: string; action?: React.ReactNode }) {
  return (
    <div className="flex-shrink-0 border-b border-surface-100 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-gray-900">{title}</h2>
        {action}
      </div>
      <p className="text-xs text-gray-400">{hint}</p>
    </div>
  );
}

function ListRow({ title, subtitle, preview, time, unread, selected, onClick, initial, avatarClassName = "bg-emerald-100 text-emerald-700" }: {
  title: string; subtitle?: string | null; preview: string; time: string | null; unread: number;
  selected: boolean; onClick: () => void; initial: string;
  /** Colour classes for the avatar (people get their own colour; see avatarColor) */
  avatarClassName?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b border-surface-50 px-4 py-3 text-left transition-colors",
        selected ? "bg-emerald-50" : "hover:bg-surface-50",
      )}
    >
      <div className={cn(
        "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold",
        avatarClassName,
      )}>
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
          <span className={cn("flex-shrink-0 text-[11px]", unread ? "font-semibold text-emerald-600" : "text-gray-400")}>{timeAgo(time)}</span>
        </div>
        {subtitle && <p className="truncate text-[11px] text-gray-400">{subtitle}</p>}
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-gray-500">{preview}</p>
          {unread > 0 && (
            <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ThreadHeader({ title, subtitle, onBack, icon, iconClassName = "bg-emerald-500" }: {
  title: string; subtitle?: string; onBack?: () => void; icon: React.ReactNode; iconClassName?: string;
}) {
  return (
    <div className="flex flex-shrink-0 items-center gap-3 bg-emerald-700 px-4 py-3 text-white">
      {onBack && (
        <button onClick={onBack} className="md:hidden" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
      )}
      <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold", iconClassName)}>{icon}</div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{title}</p>
        {subtitle && <p className="truncate text-xs text-emerald-100">{subtitle}</p>}
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center" style={{ background: "#F0F2F5" }}>
      <div className="text-center">
        <MessageCircle size={36} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm text-gray-500">{text}</p>
      </div>
    </div>
  );
}

// ─── Direct: tutor ↔ admin team ───────────────────────────────────────────────

interface DirectRow {
  id:            string;
  tutorId:       string;
  tutorName:     string | null;
  tutorEmail:    string;
  lastMessageAt: string;
  unreadCount:   number;
  lastMessage:   string | null;
  lastSender:    string | null;
}

interface TutorOption { id: string; name: string | null; email: string }

function DirectPane({ viewerId, viewerRole, onRead }: { viewerId: string; viewerRole: Role; onRead: () => void }) {
  const isAdmin = viewerRole === "admin";
  const { rows, setRows, reload } = usePolledList<DirectRow>("/api/direct-messages");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Admin starting a chat with a tutor who has no thread yet
  const [pendingTutor, setPendingTutor] = useState<TutorOption | null>(null);
  const [picking, setPicking] = useState(false);
  const [tutors,  setTutors]  = useState<TutorOption[] | null>(null);

  // Tutors have exactly one thread (with the admin team) — created by their first message
  const threadId = isAdmin ? selectedId : (rows?.[0]?.id ?? null);

  const onIncoming = useCallback(() => {
    if (threadId) void fetch(`/api/direct-messages/${threadId}`, { method: "PATCH" }).then(onRead);
  }, [threadId, onRead]);
  const { messages, loaded, load, markRead, send, reset } =
    useConversation(threadId, { live: true, viewerId, onIncoming, basePath: "/api/direct-messages" });

  useEffect(() => {
    if (!threadId) return;
    void load().then(markRead).then(onRead);
  }, [threadId, load, markRead, onRead]);

  const open = (id: string) => {
    if (id === selectedId) return;
    reset();
    setPendingTutor(null);
    setSelectedId(id);
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, unreadCount: 0 } : r)) ?? prev);
  };

  const startPicking = () => {
    setPicking(true);
    if (!tutors) {
      fetch("/api/direct-messages?tutors=1", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => { if (body) setTutors(body.data); })
        .catch(() => {});
    }
  };

  const pickTutor = (tutorId: string) => {
    setPicking(false);
    const existing = rows?.find((r) => r.tutorId === tutorId);
    if (existing) { open(existing.id); return; }
    reset();
    setSelectedId(null);
    setPendingTutor(tutors?.find((t) => t.id === tutorId) ?? null);
  };

  const onSend = async (content: string) => {
    const id = await send(content, isAdmin && pendingTutor ? { tutorId: pendingTutor.id } : {});
    if (isAdmin && !selectedId) { setSelectedId(id); setPendingTutor(null); }
    reload();
  };

  // ── Tutor: a single thread with the admin team ──
  if (!isAdmin) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <ThreadHeader title="Admin team" subtitle="Direct messages with the Edquis admins" icon={<Users size={16} />} />
        <ConversationView
          messages={messages}
          viewerId={viewerId}
          viewerRole="tutor"
          loading={rows === null || (!!threadId && !loaded)}
          emptyText="Need something from the admins — a course change, access, payments? Message them here. They'll reply in this chat."
          placeholder="Message the admin team…"
          onSend={onSend}
        />
      </div>
    );
  }

  // ── Admin: all tutors' threads, and start new ones ──
  const selected = rows?.find((r) => r.id === selectedId) ?? null;
  const colors = avatarColors((rows ?? []).map((r) => r.tutorId));
  const colorFor = (tutorId: string) => colors.get(tutorId) ?? avatarColor(tutorId);
  const threadTitle = selected ? (selected.tutorName ?? selected.tutorEmail) : pendingTutor ? (pendingTutor.name ?? pendingTutor.email) : null;
  const threadSubtitle = selected?.tutorEmail ?? pendingTutor?.email;

  return (
    <SplitView
      showThread={!!threadTitle}
      list={
        <>
          <ListHeader
            title="Tutors"
            hint="Direct chats with tutors — every admin can see and reply"
            action={
              <button onClick={startPicking}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                <Plus size={14} /> New chat
              </button>
            }
          />
          {picking && (
            <div className="flex-shrink-0 border-b border-surface-100 bg-surface-50 px-4 py-3">
              <select
                autoFocus
                defaultValue=""
                onChange={(e) => e.target.value && pickTutor(e.target.value)}
                aria-label="Choose a tutor"
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-gray-700"
              >
                <option value="" disabled>{tutors ? "Choose a tutor…" : "Loading tutors…"}</option>
                {tutors?.map((t) => <option key={t.id} value={t.id}>{t.name ? `${t.name} — ${t.email}` : t.email}</option>)}
              </select>
              <button onClick={() => setPicking(false)} className="mt-2 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {rows === null ? (
              <p className="p-6 text-center text-sm text-gray-400">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center">
                <GraduationCap size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">No chats with tutors yet</p>
                <p className="mt-1 text-xs text-gray-400">Use “New chat” to message a tutor directly.</p>
              </div>
            ) : rows.map((r) => (
              <ListRow key={r.id}
                title={r.tutorName ?? r.tutorEmail}
                preview={r.lastMessage ? `${r.lastSender ? `${r.lastSender}: ` : ""}${r.lastMessage}` : ""}
                time={r.lastMessageAt}
                unread={r.unreadCount}
                selected={r.id === selectedId}
                onClick={() => open(r.id)}
                initial={initials(r.tutorName ?? r.tutorEmail)}
                avatarClassName={colorFor(r.tutorId)} />
            ))}
          </div>
        </>
      }
      thread={threadTitle ? (
        <>
          <ThreadHeader title={threadTitle} subtitle={threadSubtitle} icon={initials(threadTitle)}
            iconClassName={colorFor(selected?.tutorId ?? pendingTutor?.id ?? threadTitle)}
            onBack={() => { reset(); setSelectedId(null); setPendingTutor(null); }} />
          <ConversationView
            messages={messages}
            viewerId={viewerId}
            viewerRole="admin"
            loading={!!threadId && !loaded}
            emptyText={`Start a direct chat with ${threadTitle}.`}
            placeholder={`Message ${threadTitle}…`}
            onSend={onSend}
          />
        </>
      ) : <Placeholder text="Select a tutor, or start a new chat" />}
    />
  );
}

// ─── Course staff channels (course tutors ↔ admins) ──────────────────────────

interface StaffRow {
  courseId:      string;
  courseTitle:   string;
  courseStatus:  string;
  tutorNames:    string[];
  lastMessage:   string | null;
  lastSender:    string | null;
  lastMessageAt: string | null;
  unreadCount:   number;
}

interface CourseOption { courseId: string; courseTitle: string; courseStatus: string; tutorNames: string[] }

/** Titles aren't unique (drafts, archived copies) — say which course, and who the message reaches. */
const statusNote = (status: string) => (status === "published" ? "" : ` (${status.replace("_", " ")})`);
const tutorsLabel = (names: string[]) => (names.length ? `Tutors: ${names.join(", ")}` : "No tutors assigned");

function StaffPane({ viewerId, viewerRole, onRead }: { viewerId: string; viewerRole: Role; onRead: () => void }) {
  const isAdmin = viewerRole === "admin";
  const { rows, setRows, reload } = usePolledList<StaffRow>("/api/staff-messages");
  const [selected, setSelected] = useState<CourseOption | null>(null);
  const [picking,  setPicking]  = useState(false);
  const [options,  setOptions]  = useState<CourseOption[] | null>(null);

  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const isViewing = useCallback(() => !!selectedRef.current, []);
  const staff = useStaffChat(selected?.courseId ?? "", !!selected, viewerId, isViewing);
  // Each course its own colour (no repeats in the list), same in the list and the header
  const colors = avatarColors((rows ?? []).map((r) => r.courseId));
  const colorFor = (courseId: string) => colors.get(courseId) ?? avatarColor(courseId);

  const open = (course: CourseOption) => {
    setPicking(false);
    setSelected(course);
    setRows((prev) => prev?.map((r) => (r.courseId === course.courseId ? { ...r, unreadCount: 0 } : r)) ?? prev);
    void fetch(`/api/staff-messages?courseId=${course.courseId}`, { method: "PATCH" }).then(onRead).catch(() => {});
  };

  const startPicking = () => {
    setPicking(true);
    if (!options) {
      fetch("/api/staff-messages?options=1", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => { if (body) setOptions(body.data); })
        .catch(() => {});
    }
  };

  // Staff messages rendered by the shared thread view (names on, no read ticks)
  const messages: ChatMessage[] = useMemo(() => staff.messages.map((m) => ({
    id: m.id, conversationId: m.courseId, senderId: m.senderId, senderRole: m.senderRole,
    senderName: m.senderName, content: m.content, readAt: null, createdAt: m.createdAt,
  })), [staff.messages]);

  return (
    <SplitView
      showThread={!!selected}
      list={
        <>
          <ListHeader
            title="Course staff"
            hint={isAdmin
              ? "Each course's channel with its tutors — students never see these"
              : "A channel per course between its tutors and the admins"}
            action={isAdmin && (
              <button onClick={startPicking}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                <Plus size={14} /> Course
              </button>
            )}
          />
          {picking && (
            <div className="flex-shrink-0 border-b border-surface-100 bg-surface-50 px-4 py-3">
              <select
                autoFocus
                defaultValue=""
                onChange={(e) => { const c = options?.find((o) => o.courseId === e.target.value); if (c) open(c); }}
                aria-label="Choose a course"
                className="w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-gray-700"
              >
                <option value="" disabled>{options ? "Choose a published course with tutors…" : "Loading courses…"}</option>
                {options?.map((o) => (
                  <option key={o.courseId} value={o.courseId}>
                    {o.courseTitle}{statusNote(o.courseStatus)} — {o.tutorNames.join(", ")}
                  </option>
                ))}
              </select>
              <button onClick={() => setPicking(false)} className="mt-2 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {rows === null ? (
              <p className="p-6 text-center text-sm text-gray-400">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center">
                <Shield size={28} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">{isAdmin ? "No course staff messages yet" : "You're not assigned to any courses yet"}</p>
                {isAdmin && <p className="mt-1 text-xs text-gray-400">Use “Course” to message a course&apos;s tutors.</p>}
              </div>
            ) : rows.map((r) => (
              <ListRow key={r.courseId}
                title={`${r.courseTitle}${statusNote(r.courseStatus)}`}
                subtitle={isAdmin ? tutorsLabel(r.tutorNames) : null}
                preview={r.lastMessage ? `${r.lastSender ? `${r.lastSender}: ` : ""}${r.lastMessage}` : "No messages yet"}
                time={r.lastMessageAt}
                unread={Number(r.unreadCount)}
                selected={r.courseId === selected?.courseId}
                onClick={() => open(r)}
                initial={(r.courseTitle[0] ?? "C").toUpperCase()}
                avatarClassName={colorFor(r.courseId)} />
            ))}
          </div>
        </>
      }
      thread={selected ? (
        <>
          <ThreadHeader
            title={`${selected.courseTitle}${statusNote(selected.courseStatus)}`}
            subtitle={isAdmin ? `Course staff · ${tutorsLabel(selected.tutorNames)}` : "Course staff — tutors and admins only"}
            icon={<Shield size={16} />}
            iconClassName={colorFor(selected.courseId)}
            onBack={() => setSelected(null)} />
          <ConversationView
            key={selected.courseId}
            messages={messages}
            viewerId={viewerId}
            viewerRole={viewerRole}
            loading={!staff.loaded}
            receipts={false}
            emptyText="No messages yet. Only this course's tutors and the admins can see this channel."
            placeholder={isAdmin ? "Message the course tutors…" : "Message the admin team about this course…"}
            onSend={async (content) => { await staff.send(content); reload(); }}
          />
        </>
      ) : <Placeholder text="Select a course" />}
    />
  );
}
