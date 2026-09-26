"use client";

import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Video, Users, Copy, Mail, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InstructorSession } from "@/services/session.service";
import { CandidateEmailPanel } from "@/components/sessions/CandidateEmailPanel";
import { useToast } from "@/components/ui/Toast";

function formatSessionDate(d: Date | string) {
  const now = new Date();
  if (new Date(d).toDateString() === now.toDateString()) return "Today";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(start: Date | string, end: Date | string) {
  const fmt = (d: Date | string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function SessionCard({ s, variant }: { s: InstructorSession; variant: "live" | "upcoming" | "past" }) {
  const { success, error } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [showCandidates, setShowCandidates] = useState(false);
  const [opening, setOpening] = useState(false);
  const isInPerson = !!s.venueAddress;
  const isOnline   = !!s.conferencePlatform;
  const mapUrl     = s.venueAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(`${s.venueAddress} ${s.venueCity ?? ""}`)}`
    : null;

  const enrolled  = s.enrolledCount ?? 0;
  const capacity  = s.capacity ?? 0;
  const fillPct   = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;
  const opensAt = new Date(s.startDatetime).getTime() - 20 * 60 * 1000;
  const endsAt = new Date(s.endDatetime).getTime();
  const canJoin = isOnline && now >= opensAt && now <= endsAt;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function getJoinUrl(): Promise<string | null> {
    try {
      const response = await fetch(`/api/sessions/${s.id}/join`);
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message ?? "Join link unavailable");
      return json.data.url;
    } catch (reason) {
      error("Unable to join", reason instanceof Error ? reason.message : "Please try again");
      return null;
    }
  }

  async function joinSession() {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setOpening(true);
    const url = await getJoinUrl();
    setOpening(false);
    if (url && popup) popup.location.href = url;
    else popup?.close();
  }

  async function copyLink() {
    const url = await getJoinUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    success("Meeting link copied");
  }

  return (
    <div className={cn(
      "flex h-full flex-col rounded-2xl border p-5 transition-all",
      variant === "live"
        ? "border-red-200 bg-red-50/50"
        : "border-surface-100 bg-white hover:border-brand-200 hover:shadow-sm"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-0.5">
            {s.courseTitle}
          </p>
          <h3 className="font-semibold text-gray-900 text-sm leading-snug">
            {s.title ?? "Live Session"}
          </h3>
        </div>
        <span className={cn(
          "flex-shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
          variant === "live"     ? "bg-red-100 text-red-600"     :
          variant === "upcoming" ? "bg-brand-50 text-brand-600"  :
          "bg-surface-100 text-gray-400"
        )}>
          {variant === "live" && (
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          )}
          {variant === "live" ? "Live now" : variant === "upcoming" ? "Upcoming" : "Past"}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1.5">
          <Calendar size={12} className="text-gray-400" />
          {formatSessionDate(s.startDatetime)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={12} className="text-gray-400" />
          {formatTime(s.startDatetime, s.endDatetime)}
        </span>
        {isInPerson && s.venueCity && (
          <span className="flex items-center gap-1.5">
            <MapPin size={12} className="text-gray-400" />
            {s.venueAddress}, {s.venueCity}
          </span>
        )}
        {isOnline && (
          <span className="flex items-center gap-1.5">
            <Video size={12} className="text-gray-400" />
            {s.conferencePlatform ?? "Online"}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto space-y-3">
        {/* Attendee count + bar */}
        <div className="flex items-center gap-2">
          <Users size={13} className="text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 flex-shrink-0">
            {enrolled} / {capacity}
          </span>
          <div className="w-16 h-1.5 rounded-full bg-surface-200 overflow-hidden flex-shrink-0">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {isOnline && (
            <>
              <button
                onClick={copyLink}
                disabled={!canJoin}
                className="flex items-center gap-1.5 rounded-xl border border-surface-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Copy size={12} /> Copy link
              </button>
              <button
                onClick={joinSession}
                disabled={!canJoin || opening}
                title={!canJoin && now < opensAt ? "Available 20 minutes before the session" : undefined}
                className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-surface-200 disabled:text-gray-400"
              >
                {canJoin ? <Video size={12} /> : <LockKeyhole size={12} />}
                {opening ? "Opening…" : canJoin ? "Join session" : variant === "past" ? "Session ended" : "Opens 20 min before"}
              </button>
            </>
          )}
          {isInPerson && (
            <>
              {mapUrl && (
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-surface-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-surface-50 transition-colors"
                >
                  <MapPin size={12} /> Directions
                </a>
              )}
            </>
          )}
          <button onClick={() => setShowCandidates(true)} className="flex items-center gap-1.5 rounded-xl border border-surface-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600 transition-colors">
            <Mail size={12} /> Email students
          </button>
        </div>
      </div>
      {showCandidates && <CandidateEmailPanel sessionId={s.id} onClose={() => setShowCandidates(false)} />}
    </div>
  );
}
