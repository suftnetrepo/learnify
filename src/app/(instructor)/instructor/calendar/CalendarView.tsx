"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  Views,
  type View,
  type ToolbarProps,
  type EventProps,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enGB } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendar-premium.css";
import { ChevronLeft, ChevronRight, Video, MapPin, CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionCard } from "../sessions/SessionCard";
import type { InstructorSession } from "@/services/session.service";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: enGB }),
  getDay,
  locales: { "en-GB": enGB },
});

interface CalendarEvent {
  title:    string;
  start:    Date;
  end:      Date;
  resource: InstructorSession;
}

type SessionStatus = "live" | "past" | "upcoming";

function sessionStatus(s: InstructorSession, now: Date): SessionStatus {
  const start = new Date(s.startDatetime);
  const end   = new Date(s.endDatetime);
  if (now >= start && now <= end) return "live";
  if (end < now) return "past";
  return "upcoming";
}

interface Props {
  sessions: InstructorSession[];
}

export function CalendarView({ sessions }: Props) {
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [selected, setSelected] = useState<InstructorSession | null>(null);

  const events = useMemo<CalendarEvent[]>(
    () =>
      sessions.map((s) => ({
        title:    `${s.courseTitle ?? "Course"} — ${s.title ?? "Live Session"}`,
        start:    new Date(s.startDatetime),
        end:      new Date(s.endDatetime),
        resource: s,
      })),
    [sessions]
  );

  const eventPropGetter = useCallback((event: CalendarEvent) => {
    const status = sessionStatus(event.resource, new Date());
    const gradient =
      status === "live"     ? "linear-gradient(135deg, #f87171 0%, #ef4444 100%)" :
      status === "past"     ? "linear-gradient(135deg, #cbd5e1 0%, #9ca3af 100%)" :
      "linear-gradient(135deg, #8080f8 0%, #6366f1 60%, #4f46e5 100%)";
    return {
      style: {
        backgroundImage: gradient,
        color:           "#fff",
        border:          "none",
        opacity:         status === "past" ? 0.75 : 1,
        fontSize:        12,
        padding:         "3px 7px",
      },
    };
  }, []);

  const now           = new Date();
  const liveCount     = sessions.filter((s) => sessionStatus(s, now) === "live").length;
  const upcomingCount = sessions.filter((s) => sessionStatus(s, now) === "upcoming").length;

  const selectedVariant: "live" | "upcoming" | "past" | null = selected
    ? sessionStatus(selected, new Date())
    : null;

  return (
    <div className="premium-calendar rounded-2xl border border-surface-100 bg-white shadow-card overflow-hidden">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-100 bg-gradient-to-r from-surface-50 to-white px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-white shadow-glow-brand">
            <CalendarDays size={18} />
          </div>
          <div>
            <h2 className="font-display text-sm font-bold text-gray-900">Session Calendar</h2>
            <p className="text-xs text-gray-400">{sessions.length} scheduled session{sessions.length === 1 ? "" : "s"}</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2">
          {liveCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> {liveCount} live
            </span>
          )}
          <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {upcomingCount} upcoming
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-100 px-3 py-1 text-xs font-semibold text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Past
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          style={{ height: 680 }}
          eventPropGetter={eventPropGetter}
          onSelectEvent={(event) => setSelected(event.resource)}
          components={{
            toolbar: CustomToolbar,
            event:   EventPill,
          }}
          popup
        />
      </div>

      {selected && selectedVariant && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />

          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4 flex-shrink-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
                  Session Details
                </p>
                <h2 className="font-display text-base font-bold text-gray-900 line-clamp-1">
                  {selected.courseTitle}
                </h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <SessionCard s={selected} variant={selectedVariant} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Custom toolbar — matches the app's rounded/brand styling instead of
// react-big-calendar's default toolbar chrome. ─────────────────────────────
function CustomToolbar({ label, onNavigate, onView, view: currentView }: ToolbarProps<CalendarEvent>) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onNavigate("PREV")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("NEXT")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 text-gray-500 hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          <ChevronRight size={15} />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("TODAY")}
          className="ml-1 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          Today
        </button>
        <h2 className="font-display ml-2 text-lg font-extrabold tracking-tight text-gray-900">{label}</h2>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-surface-50 p-1 ring-1 ring-surface-100">
        {(Object.values(Views) as View[])
          .filter((v) => v === Views.MONTH || v === Views.WEEK || v === Views.DAY)
          .map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
                currentView === v ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {v}
            </button>
          ))}
      </div>
    </div>
  );
}

// ─── Custom event pill — shows a platform/venue icon inline. ──────────────
function EventPill({ event }: EventProps<CalendarEvent>) {
  const isOnline = !!event.resource.conferenceUrl;
  return (
    <div className="flex items-center gap-1 truncate">
      {isOnline ? <Video size={10} className="flex-shrink-0" /> : <MapPin size={10} className="flex-shrink-0" />}
      <span className="truncate">{event.title}</span>
    </div>
  );
}
