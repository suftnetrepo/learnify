"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationView } from "./ConversationView";
import { useConversation } from "./useConversation";

interface Props {
  courseId:      string;
  courseTitle:   string;
  viewerId:      string;
  /** Where the floating button sits (the course player keeps it clear of its left nav). */
  buttonPositionClassName?: string;
}

/**
 * Student ↔ course tutors chat (WhatsApp-style, asynchronous). A floating "Ask Tutor" button
 * with an unread badge opens a drawer from the left (the AI tutor drawer uses the right).
 */
export function ChatDrawer({ courseId, courseTitle, viewerId, buttonPositionClassName = "bottom-6 left-6" }: Props) {
  const [open,   setOpen]   = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  // Find this student's conversation for the course (if any) and its unread count
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/messages?courseId=${courseId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const conv = body?.data?.[0];
        if (!cancelled && conv) { setConvId(conv.id); setUnread(conv.unreadCount ?? 0); }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [courseId]);

  const onIncoming = useCallback(() => {
    if (open) void fetch(`/api/messages/${convId}`, { method: "PATCH" });
    else setUnread((n) => n + 1);
  }, [open, convId]);

  // Stay connected while on the page so replies raise the badge even with the drawer closed
  const { messages, loaded, load, markRead, send } = useConversation(convId, { live: true, viewerId, onIncoming });

  useEffect(() => {
    if (!open || !convId) return;
    void load().then(markRead);
  }, [open, convId, load, markRead]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    setUnread(0);
  };

  return (
    <>
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread ? `Ask Tutor, ${unread} unread` : "Ask Tutor"}
        className={cn(
          "fixed z-40 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-emerald-700",
          buttonPositionClassName,
        )}
      >
        <MessageCircle size={16} />
        Ask Tutor
        {unread > 0 && (
          <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} aria-hidden />}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chat with course tutors"
        aria-hidden={!open}
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:w-[400px]",
          open ? "translate-x-0" : "pointer-events-none -translate-x-full",
        )}
      >
        <div className="flex flex-shrink-0 items-center gap-3 bg-emerald-700 px-4 py-3 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold">T</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Course tutors</p>
            <p className="truncate text-xs text-emerald-100">{courseTitle}</p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close" className="text-emerald-100 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <ConversationView
          messages={messages}
          viewerId={viewerId}
          viewerRole="student"
          loading={!!convId && !loaded}
          emptyText="Ask your tutors a question about this course. They'll reply here — even if you're offline, you'll see it next time."
          onSend={async (content) => {
            const id = await send(content, courseId);
            if (!convId) setConvId(id);
          }}
        />
      </div>
    </>
  );
}
