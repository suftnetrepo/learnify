"use client";

import { useState } from "react";
import { X, MapPin, Clock, Calendar, Users, Download, Share2, ExternalLink, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface Session {
  sessionId:          string;
  title:              string | null;
  startDatetime:      Date;
  endDatetime:        Date;
  conferencePlatform: string | null;
  conferenceUrl:      string | null;
  conferencePassword: string | null;
  venueAddress:       string | null;
  venueCity:          string | null;
  venuePostcode:      string | null;
  venueMapUrl:        string | null;
  capacity:           number;
  enrolledCount:      number;
}

interface CourseEnrollment {
  enrollmentId:    string;
  courseId:        string;
  courseTitle:     string | null;
  courseThumbnail: string | null;
  categoryName:    string | null;
  courseFormat:    string | null;
  progress:        number;
  enrolledAt:      Date;
  completedAt:     Date | null;
  certificateUrl:  string | null;
}

interface Props {
  enrollment: CourseEnrollment;
  session:    Session | null;
  onClose:    () => void;
}

export function CourseDetailsDrawer({ enrollment, session, onClose }: Props) {
  const [copying, setCopying] = useState(false);

  const formatDate = (d: Date) => new Date(d).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const formatTime = (start: Date, end: Date) =>
    `${new Date(start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} – ${new Date(end).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

  const isInPerson = enrollment.courseFormat === "in_person" || enrollment.courseFormat === "hybrid";
  const isOnline   = enrollment.courseFormat === "online"    || enrollment.courseFormat === "hybrid";

  async function handleShare() {
    const text = `I'm enrolled in "${enrollment.courseTitle}" on Learnify!${
      session ? `\n📅 ${formatDate(session.startDatetime)}\n🕐 ${formatTime(session.startDatetime, session.endDatetime)}${
        session.venueCity ? `\n📍 ${session.venueCity}` : ""
      }` : ""
    }`;
    try {
      if (navigator.share) {
        await navigator.share({ title: enrollment.courseTitle ?? "", text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopying(true);
        setTimeout(() => setCopying(false), 2000);
      }
    } catch { /* user cancelled */ }
  }

  async function handleDownload() {
    const res = await fetch(`/api/enrollments/${enrollment.enrollmentId}/booking-confirmation`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `learnify-booking-${(enrollment.courseTitle ?? "course").toLowerCase().replace(/\s+/g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-100 px-6 py-4 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
              Booking Details
            </p>
            <h2 className="font-display text-base font-bold text-gray-900 line-clamp-1">
              {enrollment.courseTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Enrollment status */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-semibold text-emerald-700">Enrolled</span>
            </div>
            <span className="text-xs text-emerald-600">
              Since {new Date(enrollment.enrolledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>

          {/* Course info */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Course</p>
            <div className="rounded-xl border border-surface-100 p-4 space-y-2">
              {enrollment.categoryName && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500">
                  {enrollment.categoryName}
                </p>
              )}
              <p className="font-semibold text-gray-900">{enrollment.courseTitle}</p>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                  enrollment.courseFormat === "in_person" ? "bg-amber-100 text-amber-700" :
                  enrollment.courseFormat === "hybrid"    ? "bg-violet-100 text-violet-700" :
                  "bg-brand-50 text-brand-700"
                )}>
                  {enrollment.courseFormat?.replace("_", "-") ?? "Online"}
                </span>
                {enrollment.progress > 0 && (
                  <span className="text-xs text-gray-400">{enrollment.progress}% complete</span>
                )}
              </div>
            </div>
          </div>

          {/* Session details */}
          {session && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Session</p>
              <div className="rounded-xl border border-surface-100 p-4 space-y-3">
                <p className="font-semibold text-gray-900">{session.title ?? "Live Session"}</p>

                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 text-sm text-gray-600">
                    <Calendar size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>{formatDate(session.startDatetime)}</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-sm text-gray-600">
                    <Clock size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>{formatTime(session.startDatetime, session.endDatetime)}</span>
                  </div>
                  <div className="flex items-start gap-2.5 text-sm text-gray-600">
                    <Users size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <span>
                      {session.enrolledCount} / {session.capacity} seats taken
                      <span className="text-xs text-emerald-600 font-medium ml-1">(you&apos;re enrolled ✓)</span>
                    </span>
                  </div>
                </div>

                {/* Venue — in-person */}
                {isInPerson && session.venueAddress && (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                      <MapPin size={10} /> Venue
                    </p>
                    <p className="text-sm font-medium text-gray-900">{session.venueAddress}</p>
                    {session.venueCity && (
                      <p className="text-sm text-gray-600">
                        {session.venueCity}{session.venuePostcode ? `, ${session.venuePostcode}` : ""}
                      </p>
                    )}
                    {session.venueMapUrl && (
                      <a
                        href={session.venueMapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:underline mt-1"
                      >
                        <MapPin size={11} /> Get directions →
                      </a>
                    )}
                  </div>
                )}

                {/* Conference — online */}
                {isOnline && session.conferenceUrl && (
                  <div className="rounded-lg bg-brand-50 border border-brand-100 p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">
                      Join online
                    </p>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {session.conferencePlatform ?? "Video call"}
                    </p>
                    {session.conferencePassword && (
                      <p className="text-xs text-gray-500">
                        Password: <span className="font-mono font-semibold">{session.conferencePassword}</span>
                      </p>
                    )}
                    <a
                      href={session.conferenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline mt-1"
                    >
                      <ExternalLink size={11} /> Join session →
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Certificate */}
          {enrollment.completedAt && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Certificate</p>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700">Course completed</span>
                </div>
                {enrollment.certificateUrl && (
                  <a
                    href={enrollment.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Download →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* What to bring — in-person only */}
          {isInPerson && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">What to bring</p>
              <div className="rounded-xl border border-surface-100 p-4 space-y-2">
                {["A laptop (fully charged)", "Photo ID for venue check-in", "Notebook and pen", "Water bottle"].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-surface-100 px-6 py-4 flex gap-3 flex-shrink-0">
          <button
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-surface-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-surface-50 transition-colors"
          >
            <Share2 size={15} />
            {copying ? "Copied!" : "Share"}
          </button>
          <button
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            <Download size={15} />
            Download 
          </button>
        </div>
      </div>
    </>
  );
}
