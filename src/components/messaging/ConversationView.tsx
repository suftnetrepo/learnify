"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Eye, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "./useConversation";

interface Props {
  messages:      ChatMessage[];
  viewerId:      string;
  viewerRole:    "student" | "tutor" | "admin";
  readOnly?:     boolean;
  /** Still fetching the thread — show "Loading…" rather than the empty state */
  loading?:      boolean;
  emptyText:     string;
  onSend:        (content: string) => Promise<void>;
  /** Show ✓ / ✓✓ on own messages (off for channels without read receipts) */
  receipts?:     boolean;
  placeholder?:  string;
}

const dayLabel = (d: Date) => {
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

/** WhatsApp-style thread: day separators, bubbles, time + read ticks, and the composer. */
export function ConversationView({
  messages, viewerId, viewerRole, readOnly, loading, emptyText, onSend, receipts = true, placeholder = "Type a message…",
}: Props) {
  const [input,   setInput]   = useState("");
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view (scroll the thread only, not the page)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

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

  const sideLabel = (m: ChatMessage) =>
    m.senderRole === "student" ? "Student" : m.senderRole === "admin" ? "Admin" : "Tutor";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3" style={{ background: "#ECE5DD" }}>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-xs rounded-xl bg-white px-4 py-3 text-center text-sm text-gray-600 shadow-sm">
              {loading ? "Loading…" : emptyText}
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const own  = m.senderId === viewerId;
            const date = new Date(m.createdAt);
            const newDay = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== date.toDateString();
            // Show who's talking when it isn't obvious: other-side messages, and colleagues' in a shared inbox
            // Named senders (direct / staff chats) show their name; otherwise the side
            const label = !own && (m.senderName ?? (viewerRole === "student" ? "Tutor" : sideLabel(m)));
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-2 flex justify-center">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] text-gray-500 shadow-sm">{dayLabel(date)}</span>
                  </div>
                )}
                <div className={cn("mb-1.5 flex", own ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[80%] rounded-xl px-3 py-2 text-sm text-gray-800 shadow-sm",
                    own ? "rounded-tr-none bg-[#DCF8C6]" : "rounded-tl-none bg-white",
                  )}>
                    {label && (
                      <p className={cn("mb-0.5 text-xs font-semibold",
                        m.senderRole === "student" ? "text-sky-700" : m.senderRole === "admin" ? "text-purple-700" : "text-emerald-700")}>{label}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                    <div className="mt-0.5 flex items-center justify-end gap-1">
                      <span className="text-[10px] text-gray-400">
                        {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {own && receipts && (m.readAt
                        ? <CheckCheck size={13} className="text-sky-500" aria-label="Read" />
                        : <Check      size={13} className="text-gray-400" aria-label="Sent" />)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {readOnly ? (
        <div className="flex flex-shrink-0 items-center justify-center gap-2 border-t border-surface-100 bg-white px-4 py-3 text-xs text-gray-500">
          <Eye size={14} /> Read-only — admins can view conversations but not reply.
        </div>
      ) : (
        <div className="flex-shrink-0 border-t border-surface-100 bg-white px-3 py-3">
          {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
              }}
              placeholder={placeholder}
              aria-label="Message"
              rows={1}
              maxLength={4000}
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-surface-200 bg-surface-50 px-4 py-2 text-sm outline-none focus:border-emerald-400"
            />
            <button
              onClick={() => void submit()}
              disabled={!input.trim() || sending}
              aria-label="Send message"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white transition-colors hover:bg-emerald-700 disabled:bg-gray-300"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
