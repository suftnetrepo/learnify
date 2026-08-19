"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Video, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { StudentSession } from "./my-courses/MyCoursesList";

function formatCountdown(target: Date, from: Date) {
  const totalMinutes = Math.max(0, Math.round((target.getTime() - from.getTime()) / 60000));
  const hours   = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

interface Props {
  allSessions: StudentSession[];
  now:         Date;
}

export function CalendarWidget({ allSessions, now }: Props) {
  const todayStr = now.toDateString();

  // anchorDate drives which 7-day window is visible; selectedDate drives
  // which day's sessions are shown below. They're independent — Prev/Next
  // slides the window, clicking a day just changes the selection within it.
  const [anchorDate, setAnchorDate]     = useState(now);
  const [selectedDate, setSelectedDate] = useState(now);

  const calendarDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchorDate);
      d.setDate(anchorDate.getDate() - 3 + i);
      return d;
    }),
    [anchorDate]
  );

  const sessionDays = useMemo(
    () => new Set(allSessions.map((s) => new Date(s.startDatetime).toDateString())),
    [allSessions]
  );

  const selectedStr = selectedDate.toDateString();
  const isSelectedToday = selectedStr === todayStr;

  const daySessions = allSessions.filter(
    (s) => new Date(s.startDatetime).toDateString() === selectedStr
  );

  function shiftWindow(days: number) {
    const d = new Date(anchorDate);
    d.setDate(anchorDate.getDate() + days);
    setAnchorDate(d);
  }

  return (
    <div className="rounded-2xl border border-surface-100 bg-white p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <CalendarDays size={16} className="text-brand-500" /> Calendar
        </h2>
        <span className="flex items-center gap-1 text-sm text-gray-500">
          {anchorDate.toLocaleDateString("en-GB", { month: "long" })}
          <ChevronDown size={14} />
        </span>
      </div>

      {/* Day strip */}
      <div className="flex items-center gap-1 mb-5">
        <button
          type="button"
          onClick={() => shiftWindow(-7)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-gray-300 hover:bg-surface-50 hover:text-gray-600 transition-colors"
          aria-label="Previous days"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="grid flex-1 grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayStr      = day.toDateString();
            const isToday     = dayStr === todayStr;
            const isSelected  = dayStr === selectedStr;
            const hasSession  = sessionDays.has(dayStr);
            return (
              <button
                key={dayStr}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2 cursor-pointer transition-colors",
                  isSelected ? "bg-brand-500" : "hover:bg-surface-50",
                  isToday && !isSelected && "ring-1 ring-inset ring-brand-200"
                )}
              >
                <span className={cn("text-sm font-bold", isSelected ? "text-white" : "text-gray-900")}>
                  {day.getDate()}
                </span>
                <span className={cn("text-[10px]", isSelected ? "text-white/70" : "text-gray-400")}>
                  {day.toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
                <div className={cn(
                  "h-1 w-1 rounded-full",
                  hasSession ? (isSelected ? "bg-white" : "bg-brand-500") : "bg-transparent"
                )} />
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => shiftWindow(7)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-gray-300 hover:bg-surface-50 hover:text-gray-600 transition-colors"
          aria-label="Next days"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Selected day's sessions */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">
          {isSelectedToday
            ? "Today's Sessions"
            : selectedDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
        </h3>
        <Link href="/dashboard/calendar" className="text-xs font-medium text-brand-600 hover:underline">
          View calendar →
        </Link>
      </div>

      {daySessions.length === 0 ? (
        <div className="text-center py-8">
          <CalendarDays size={24} className="mx-auto mb-2 text-gray-200" />
          <p className="text-xs text-gray-400">No sessions {isSelectedToday ? "today" : "on this day"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {daySessions.map((s) => {
            const isLiveNow = now >= new Date(s.startDatetime) && now <= new Date(s.endDatetime);
            const startTime = new Date(s.startDatetime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            const endTime   = new Date(s.endDatetime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            const platform  = s.conferencePlatform ?? "Online";
            return (
              <div key={s.sessionId} className={cn("rounded-2xl p-4", isLiveNow ? "bg-brand-50" : "bg-surface-50")}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500 mb-0.5">
                  {s.courseTitle}
                </p>
                <p className="text-sm font-semibold text-gray-900 mb-2">{s.title ?? "Live Session"}</p>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-gray-600">{startTime} – {endTime}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700">
                    <Video size={11} /> {platform}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  {isLiveNow ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      Live now
                    </span>
                  ) : new Date(s.startDatetime) > now ? (
                    <span className="text-xs text-gray-400">
                      Starts in {formatCountdown(new Date(s.startDatetime), now)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Ended</span>
                  )}
                  {s.conferenceUrl ? (
                    <a href={s.conferenceUrl} target="_blank" rel="noopener noreferrer"
                      className={cn(
                        "flex flex-shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors",
                        isLiveNow
                          ? "bg-brand-500 text-white hover:bg-brand-600"
                          : "bg-brand-100 text-brand-700 hover:bg-brand-200"
                      )}
                    >
                      <ExternalLink size={12} />
                      {isLiveNow ? "Join now" : "View details"}
                    </a>
                  ) : (
                    <Link href="/dashboard/calendar"
                      className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-brand-100 px-4 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-200 transition-colors"
                    >
                      View details
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
