"use client";

import { Calendar, Clock, MapPin, Video, Users, Copy, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InstructorSession } from "@/services/session.service";

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
  const isInPerson = !!s.venueAddress;
  const isOnline   = !!s.conferenceUrl;
  const mapUrl     = s.venueAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(`${s.venueAddress} ${s.venueCity ?? ""}`)}`
    : null;

  const enrolled  = s.enrolledCount ?? 0;
  const capacity  = s.capacity ?? 0;
  const fillPct   = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0;

  return (
    <div className={cn(
      "rounded-2xl border p-5 transition-all",
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
      <div className="space-y-3">
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
          {isOnline && s.conferenceUrl && (
            <>
              <button
                onClick={() => navigator.clipboard.writeText(s.conferenceUrl!)}
                className="flex items-center gap-1.5 rounded-xl border border-surface-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-surface-50 transition-colors"
              >
                <Copy size={12} /> Copy link
              </button>
              <a
                href={s.conferenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                <Video size={12} /> Join session
              </a>
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
              <button className="flex items-center gap-1.5 rounded-xl border border-surface-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-surface-50 transition-colors">
                <Mail size={12} /> Email students
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
