"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationView } from "./ConversationView";
import { useConversation } from "./useConversation";

interface ConversationRow {
  id:            string;
  courseId:      string;
  courseTitle:   string;
  studentName:   string | null;
  lastMessageAt: string;
  unreadCount:   number;
  lastMessage:   string | null;
  lastSender:    string | null;
}

const LIST_REFRESH_MS = 10000;

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * WhatsApp-Web style inbox: conversations on the left, the open thread on the right.
 * Tutors see their assigned courses and reply; admins see every course, read-only.
 */
export function MessagesInbox({ viewerId, viewerRole }: { viewerId: string; viewerRole: "tutor" | "admin" }) {
  const [rows,       setRows]       = useState<ConversationRow[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [courseId,   setCourseId]   = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const readOnly = viewerRole === "admin";

  // Load + periodically refresh the list (new conversations, previews, unread counts)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/messages", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (!cancelled && body) setRows(body.data); })
      .catch(() => {});
    const timer = setTimeout(() => setRefreshTick((n) => n + 1), LIST_REFRESH_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [refreshTick]);

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    rows?.forEach((r) => map.set(r.courseId, r.courseTitle));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);
  const visible = (rows ?? []).filter((r) => !courseId || r.courseId === courseId);
  const selected = rows?.find((r) => r.id === selectedId) ?? null;

  const onIncoming = useCallback(() => {
    if (!readOnly && selectedId) void fetch(`/api/messages/${selectedId}`, { method: "PATCH" });
  }, [readOnly, selectedId]);
  const { messages, loaded, load, markRead, send, reset } = useConversation(selectedId, { live: true, viewerId, onIncoming });

  useEffect(() => {
    if (!selectedId) return;
    void load().then(() => (readOnly ? undefined : markRead()));
  }, [selectedId, load, markRead, readOnly]);

  const openConversation = (id: string) => {
    if (id === selectedId) return;
    reset();
    setSelectedId(id);
    if (!readOnly) setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, unreadCount: 0 } : r)) ?? prev);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 bg-white">
      {/* Conversation list */}
      <aside className={cn(
        "flex w-full flex-col border-r border-surface-100 md:w-[340px] md:flex-shrink-0",
        selectedId && "hidden md:flex",
      )}>
        <div className="flex-shrink-0 border-b border-surface-100 px-4 py-4">
          <h1 className="font-display text-lg font-bold text-gray-900">Messages</h1>
          <p className="text-xs text-gray-400">
            {readOnly ? "All student ↔ tutor conversations (read-only)" : "Questions from students on your courses"}
          </p>
          {courses.length > 1 && (
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              aria-label="Filter by course"
              className="mt-3 w-full rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="">All courses</option>
              {courses.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {rows === null ? (
            <p className="p-6 text-center text-sm text-gray-400">Loading…</p>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">No conversations yet</p>
              <p className="mt-1 text-xs text-gray-400">Students can message you from their course page.</p>
            </div>
          ) : visible.map((r) => (
            <button
              key={r.id}
              onClick={() => openConversation(r.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-surface-50 px-4 py-3 text-left transition-colors",
                r.id === selectedId ? "bg-emerald-50" : "hover:bg-surface-50",
              )}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                {(r.studentName ?? "S")[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{r.studentName ?? "Student"}</p>
                  <span className={cn("flex-shrink-0 text-[11px]", r.unreadCount ? "font-semibold text-emerald-600" : "text-gray-400")}>
                    {timeAgo(r.lastMessageAt)}
                  </span>
                </div>
                <p className="truncate text-[11px] text-gray-400">{r.courseTitle}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-gray-500">
                    {r.lastSender && r.lastSender !== "student" && <span className="text-gray-400">Tutor: </span>}
                    {r.lastMessage ?? ""}
                  </p>
                  {!readOnly && r.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
                      {r.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Thread */}
      <section className={cn("min-w-0 flex-1 flex-col", selectedId ? "flex" : "hidden md:flex")}>
        {selected ? (
          <>
            <div className="flex flex-shrink-0 items-center gap-3 bg-emerald-700 px-4 py-3 text-white">
              <button onClick={() => setSelectedId(null)} className="md:hidden" aria-label="Back to conversations">
                <ArrowLeft size={18} />
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold">
                {(selected.studentName ?? "S")[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selected.studentName ?? "Student"}</p>
                <p className="truncate text-xs text-emerald-100">{selected.courseTitle}</p>
              </div>
            </div>
            <ConversationView
              messages={messages}
              viewerId={viewerId}
              viewerRole={viewerRole}
              readOnly={readOnly}
              loading={!loaded}
              emptyText="No messages yet"
              onSend={async (content) => { await send(content); }}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center" style={{ background: "#F0F2F5" }}>
            <div className="text-center">
              <MessageCircle size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">Select a conversation</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
