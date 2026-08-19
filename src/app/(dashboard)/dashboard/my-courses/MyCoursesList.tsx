"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  BookOpen, Trophy, Award, PlayCircle, Clock, Calendar,
  ExternalLink, MapPin, Video, Info,
} from "lucide-react";
import { CourseDetailsDrawer } from "./CourseDetailsDrawer";
import type { SessionService } from "@/services/session.service";

export type StudentSession = Awaited<ReturnType<typeof SessionService.getStudentSessions>>[number];

export interface EnrolledCourse {
  enrollmentId:    string;
  courseId:        string;
  courseTitle:     string | null;
  courseThumbnail: string | null;
  categoryName:    string | null;
  courseFormat:    string | null;
  progress:        string | number;
  enrolledAt:      Date;
  completedAt:     Date | null;
  certificateUrl:  string | null;
}

const THUMB_GRADIENTS = [
  "from-indigo-700 to-brand-500",
  "from-sky-700 to-cyan-500",
  "from-emerald-700 to-teal-500",
  "from-violet-700 to-purple-500",
  "from-rose-700 to-pink-500",
  "from-amber-700 to-orange-500",
];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function getCourseSessionStatus(courseId: string, sessions: StudentSession[], now: Date) {
  const courseSessions = sessions.filter((s) => s.courseId === courseId);
  if (!courseSessions.length) return null;

  const live = courseSessions.find(
    (s) => now >= new Date(s.startDatetime) && now <= new Date(s.endDatetime)
  );
  if (live) return { type: "live" as const, session: live };

  const todayUpcoming = courseSessions.find((s) => {
    const start = new Date(s.startDatetime);
    return start.toDateString() === now.toDateString() && start > now;
  });
  if (todayUpcoming) return { type: "today" as const, session: todayUpcoming };

  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = courseSessions.find((s) => {
    const start = new Date(s.startDatetime);
    return start > now && start <= weekFromNow;
  });
  if (upcoming) return { type: "upcoming" as const, session: upcoming };

  return null;
}

// The single most relevant session to show in the details drawer — broader
// than getCourseSessionStatus above (which only cares about live/soon, for
// the card banner); this picks *something* to show even if every session
// for the course has already passed.
function getCourseSession(courseId: string, sessions: StudentSession[], now: Date) {
  const courseSessions = sessions.filter((s) => s.courseId === courseId);
  return (
    courseSessions.find((s) => now >= new Date(s.startDatetime) && now <= new Date(s.endDatetime)) ??
    courseSessions.find((s) => new Date(s.startDatetime).toDateString() === now.toDateString()) ??
    courseSessions.find((s) => new Date(s.startDatetime) > now) ??
    courseSessions[0] ??
    null
  );
}

interface Props {
  enrolled:     EnrolledCourse[];
  allSessions:  StudentSession[];
  now:          Date;
}

export function MyCoursesList({ enrolled, allSessions, now }: Props) {
  const [selected, setSelected] = useState<{ enrollment: EnrolledCourse; session: StudentSession | null } | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {enrolled.map((e) => {
          const gradient      = THUMB_GRADIENTS[hashStr(e.courseId) % THUMB_GRADIENTS.length];
          const progress      = Number(e.progress);
          const isComplete    = !!e.completedAt;
          const sessionStatus = getCourseSessionStatus(e.courseId, allSessions, now);

          return (
            <div
              key={e.enrollmentId}
              className="flex flex-col rounded-2xl border border-surface-100 bg-white overflow-hidden hover:border-brand-200 hover:shadow-sm transition-all"
            >
              {/* Thumbnail */}
              <div className={`relative h-[110px] w-full bg-gradient-to-br ${gradient} overflow-hidden`}>
                {e.courseThumbnail ? (
                  <Image
                    src={e.courseThumbnail}
                    alt={e.courseTitle ?? ""}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BookOpen size={24} className="text-white/30" />
                  </div>
                )}

                {isComplete ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">
                      <Trophy size={12} /> Completed
                    </div>
                  </div>
                ) : sessionStatus?.type === "live" ? (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    Live now
                  </div>
                ) : sessionStatus?.type === "today" ? (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    <Clock size={10} /> Today
                  </div>
                ) : null}
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-4">
                <div className="flex-1">
                  {e.categoryName && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1">
                      {e.categoryName}
                    </p>
                  )}
                  <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 leading-snug mb-3">
                    {e.courseTitle}
                  </h3>

                  {!isComplete ? (
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="flex-1 h-1 rounded-full bg-surface-100 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[11px] font-semibold text-gray-400 flex-shrink-0">
                        {progress > 0 ? `${progress}%` : "Not started"}
                      </span>
                    </div>
                  ) : (
                    <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                      <Award size={12} /> Certificate earned
                    </div>
                  )}

                  {/* Session status banner */}
                  {sessionStatus && (
                    <div className={cn(
                      "mb-3 rounded-xl border p-3",
                      sessionStatus.type === "live"
                        ? "border-red-200 bg-red-50"
                        : sessionStatus.type === "today"
                        ? "border-amber-200 bg-amber-50"
                        : "border-brand-200 bg-brand-50"
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn(
                            "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-0.5",
                            sessionStatus.type === "live" ? "text-red-500"
                            : sessionStatus.type === "today" ? "text-amber-600"
                            : "text-brand-600"
                          )}>
                            {sessionStatus.type === "live" ? (
                              <><span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> Happening now</>
                            ) : sessionStatus.type === "today" ? (
                              <><Clock size={10} /> Today&apos;s session</>
                            ) : (
                              <><Calendar size={10} /> Upcoming session</>
                            )}
                          </p>
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {sessionStatus.session.title ?? "Live Session"}
                          </p>
                          <p className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5">
                            {new Date(sessionStatus.session.startDatetime).toLocaleTimeString("en-GB", {
                              hour: "2-digit", minute: "2-digit",
                            })}
                            {" – "}
                            {new Date(sessionStatus.session.endDatetime).toLocaleTimeString("en-GB", {
                              hour: "2-digit", minute: "2-digit",
                            })}
                            {" · "}
                            {sessionStatus.session.venueCity ? (
                              <span className="inline-flex items-center gap-0.5">
                                <MapPin size={10} /> {sessionStatus.session.venueCity}
                              </span>
                            ) : sessionStatus.session.conferencePlatform ? (
                              <span className="inline-flex items-center gap-0.5">
                                <Video size={10} /> {sessionStatus.session.conferencePlatform}
                              </span>
                            ) : (
                              "Online"
                            )}
                          </p>
                        </div>
                        {sessionStatus.session.conferenceUrl && (
                          <a
                            href={sessionStatus.session.conferenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex-shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors",
                              sessionStatus.type === "live"
                                ? "bg-red-500 text-white hover:bg-red-600"
                                : "bg-brand-500 text-white hover:bg-brand-600"
                            )}
                          >
                            <ExternalLink size={11} />
                            {sessionStatus.type === "live" ? "Join" : "View"}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/learn/${e.courseId}`}
                    className="flex flex-1 h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
                  >
                    <PlayCircle size={15} />
                    {progress > 0 ? "Continue learning" : "Start learning"}
                  </Link>
                  <button
                    onClick={() => setSelected({ enrollment: e, session: getCourseSession(e.courseId, allSessions, now) })}
                    className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-surface-200 text-gray-400 hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
                    title="View details"
                  >
                    <Info size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <CourseDetailsDrawer
          enrollment={{ ...selected.enrollment, progress: Number(selected.enrollment.progress) }}
          session={selected.session}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
