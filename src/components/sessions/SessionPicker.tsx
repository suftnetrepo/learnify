"use client";

import { useState } from "react";
import { Calendar, Clock, MapPin, Video, Users, AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Session {
  id:                 string;
  title:              string;
  startDatetime:      string;
  endDatetime:        string;
  capacity:           number;
  enrolledCount:      number;
  seatsRemaining:     number;
  isFull:             boolean;
  venueCity:          string | null;
  venueAddress:       string | null;
  venuePostcode:      string | null;
  conferencePlatform: string | null;
}

interface Props {
  sessions:          Session[];
  selectedSessionId: string | null;
  onSelect:          (id: string) => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  zoom: "Zoom", teams: "Microsoft Teams", google_meet: "Google Meet",
  webex: "Cisco Webex", other: "Online",
};

export function SessionPicker({ sessions, selectedSessionId, onSelect }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">No sessions available</p>
          <p className="text-xs text-amber-600 mt-0.5">
            There are no upcoming sessions scheduled for this course. Check back soon or contact us.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => {
        const start     = new Date(s.startDatetime);
        const end       = new Date(s.endDatetime);
        const isSelected = selectedSessionId === s.id;
        const pct       = s.capacity > 0 ? Math.round((s.enrolledCount / s.capacity) * 100) : 0;

        return (
          <button
            key={s.id}
            type="button"
            disabled={s.isFull}
            onClick={() => !s.isFull && onSelect(s.id)}
            className={cn(
              "w-full text-left rounded-2xl border p-4 transition-all",
              s.isFull      && "cursor-not-allowed opacity-50 bg-surface-50 border-surface-200",
              isSelected    && !s.isFull && "border-brand-400 bg-brand-50 ring-2 ring-brand-100",
              !isSelected   && !s.isFull && "border-surface-200 bg-white hover:border-brand-200 hover:bg-surface-50",
            )}
          >
            <div className="flex items-start gap-3">
              {/* Date badge */}
              <div className="flex-shrink-0 w-12 text-center rounded-xl bg-white border border-surface-200 py-1.5 shadow-sm">
                <p className="text-xs font-bold text-brand-600 uppercase tracking-wide leading-tight">
                  {start.toLocaleDateString("en-GB", { month: "short" })}
                </p>
                <p className="text-xl font-bold text-gray-900 leading-tight">{start.getDate()}</p>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm text-gray-900 truncate">{s.title}</p>
                  {isSelected && (
                    <div className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </div>

                {/* Time + location row */}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {s.venueCity && (
                    <span className="flex items-center gap-1">
                      <MapPin size={10} />{s.venueCity}
                    </span>
                  )}
                  {s.conferencePlatform && !s.venueCity && (
                    <span className="flex items-center gap-1">
                      <Video size={10} />{PLATFORM_LABELS[s.conferencePlatform] ?? "Online"}
                    </span>
                  )}
                </div>

                {/* Seats remaining */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-surface-100">
                    <div
                      className={cn("h-1 rounded-full", pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-emerald-400")}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className={cn("text-xs font-medium flex-shrink-0", s.isFull ? "text-red-500" : "text-gray-400")}>
                    <Users size={9} className="inline mr-0.5" />
                    {s.isFull ? "Full" : `${s.seatsRemaining} left`}
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
