"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight,
  Download, PlayCircle, Menu, X, ArrowLeft,
  Video, Radio, MapPin, FileText, Code2, ArrowRight,
} from "lucide-react";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { cn, formatDuration } from "@/lib/utils";
import Link from "next/link";

interface Lecture {
  id:            string;
  title:         string;
  description:   string | null;
  videoUrl:      string | null;
  videoDuration: number | null;
  isFree:        boolean;
  sortOrder:     number;
  sectionId:     string;
}

interface Section {
  id:       string;
  title:    string;
  lectures: Lecture[];
}

interface ProgressRow {
  watchedSeconds: number;
  isCompleted:    boolean;
}

interface Props {
  course: { id: string; title: string; thumbnailUrl: string | null };
  enrollment: {
    id:             string;
    progress:       number;
    completedAt:    Date | null;
    certificateUrl: string | null;
  };
  sections:        Section[];
  activeLecture:   Lecture | null;
  activeProgress:  ProgressRow | null;
  progressMap:     Record<string, ProgressRow>;
  totalLectures:   number;
}

function getLectureFormat(lecture: Lecture): "video" | "live" | "in_person" {
  const t = lecture.title.toLowerCase();
  if (t.includes("live") || t.includes("q&a") || t.includes("session")) return "live";
  if (t.includes("workshop") || t.includes("in-person") || t.includes("in person")) return "in_person";
  return "video";
}

function FormatPill({ format }: { format: "video" | "live" | "in_person" }) {
  if (format === "live") return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">Live</span>
  );
  if (format === "in_person") return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">In-person</span>
  );
  return null;
}

function FormatIcon({ format, size = 12 }: { format: "video" | "live" | "in_person"; size?: number }) {
  if (format === "live")      return <Radio     size={size} className="text-gray-400" />;
  if (format === "in_person") return <MapPin    size={size} className="text-gray-400" />;
  return                             <Video     size={size} className="text-gray-400" />;
}

function Curriculum({
  course, enrollment, sections, activeLecture, progressMap,
  totalLectures, completedCount, overallProgress,
  expandedSections, setExpanded, goToLecture, onSelect,
}: {
  course:           Props["course"];
  enrollment:       Props["enrollment"];
  sections:         Section[];
  activeLecture:    Lecture | null;
  progressMap:      Record<string, ProgressRow>;
  totalLectures:    number;
  completedCount:   number;
  overallProgress:  number;
  expandedSections: Record<string, boolean>;
  setExpanded:      React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  goToLecture:      (l: Lecture) => void;
  onSelect?:        () => void;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* Sidebar header */}
      <div className="border-b border-surface-100 px-4 py-4 flex-shrink-0 bg-surface-50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600 mb-1">
          Course Content
        </p>
        <h2 className="text-[13px] font-medium text-gray-900 leading-snug line-clamp-2 mb-3">
          {course.title}
        </h2>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-gray-400">{completedCount} / {totalLectures} lectures</span>
          <span className="text-[11px] font-semibold text-brand-600">{overallProgress}%</span>
        </div>
        <div className="h-[3px] w-full rounded-full bg-surface-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Sections + lectures */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
        {sections.map((section) => {
          const sectionDone = section.lectures.every((l) => progressMap[l.id]?.isCompleted);
          const isExpanded  = expandedSections[section.id] ?? true;

          return (
            <div key={section.id}>
              <button
                onClick={() => setExpanded((p) => {
                  const isOpen = p[section.id];
                  const allClosed = Object.fromEntries(sections.map((s) => [s.id, false]));
                  return { ...allClosed, [section.id]: !isOpen };
                })}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-surface-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {sectionDone
                    ? <CheckCircle2 size={13} className="flex-shrink-0 text-emerald-500" />
                    : <div className="h-[11px] w-[11px] flex-shrink-0 rounded-full border-[1.5px] border-gray-300" />
                  }
                  <span className="text-[11px] font-semibold text-gray-500 truncate">{section.title}</span>
                </div>
                {isExpanded
                  ? <ChevronDown  size={12} className="text-gray-400 flex-shrink-0" />
                  : <ChevronRight size={12} className="text-gray-400 flex-shrink-0" />
                }
              </button>

              {isExpanded && section.lectures.map((lecture) => {
                const prog     = progressMap[lecture.id];
                const isActive = lecture.id === activeLecture?.id;
                const isDone   = prog?.isCompleted;
                const fmt      = getLectureFormat(lecture);

                return (
                  <button
                    key={lecture.id}
                    onClick={() => { goToLecture(lecture); onSelect?.(); }}
                    className={cn(
                      "flex w-full items-start gap-2.5 py-2 pl-6 pr-4 text-left transition-colors border-l-2",
                      isActive
                        ? "bg-brand-50 border-brand-500"
                        : "border-transparent hover:bg-surface-50"
                    )}
                  >
                    {/* Status icon */}
                    <div className={cn(
                      "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-[1.5px]",
                      isDone   ? "border-emerald-500 bg-emerald-50"   :
                      isActive ? "border-brand-500 bg-brand-50" :
                                 "border-gray-300"
                    )}>
                      {isDone
                        ? <CheckCircle2 size={9} className="text-emerald-500" />
                        : isActive
                        ? <PlayCircle   size={9} className="text-brand-500" />
                        : null
                      }
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-[12px] leading-snug line-clamp-2",
                        isActive ? "font-medium text-brand-700" : "text-gray-600"
                      )}>
                        {lecture.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <FormatIcon format={fmt} size={10} />
                        <span className="text-[10px] text-gray-400">
                          {lecture.videoDuration
                            ? formatDuration(Math.round(lecture.videoDuration / 60))
                            : "--"}
                        </span>
                        <FormatPill format={fmt} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Certificate */}
      {overallProgress >= 100 && (
        <div className="border-t border-surface-100 p-3 flex-shrink-0">
          <a
            href={`/api/enrollments/${enrollment.id}/certificate`}
            target="_blank"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            <Download size={13} /> Download Certificate
          </a>
        </div>
      )}
    </div>
  );
}

export function CourseViewer({
  course, enrollment, sections,
  activeLecture: initialLecture, activeProgress,
  progressMap: initialProgressMap, totalLectures,
}: Props) {
  const router = useRouter();
  const [activeLecture,    setActiveLecture] = useState(initialLecture);
  const [progressMap,      setProgressMap]   = useState(initialProgressMap);
  const initialSection = sections.find((s) =>
    s.lectures.some((l) => l.id === initialLecture?.id)
  ) ?? sections[0];

  const [expandedSections, setExpanded]      = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map((s) => [s.id, s.id === initialSection?.id]))
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allLectures     = sections.flatMap((s) => s.lectures);
  const completedCount  = Object.values(progressMap).filter((p) => p.isCompleted).length;
  const overallProgress = totalLectures > 0
    ? Math.round((completedCount / totalLectures) * 100)
    : 0;

  const goToLecture = useCallback((lecture: Lecture) => {
    setActiveLecture(lecture);
    router.replace(`/dashboard/courses/${course.id}?lecture=${lecture.id}`, { scroll: false });
  }, [course.id, router]);

  const handleLectureComplete = useCallback(() => {
    const idx  = allLectures.findIndex((l) => l.id === activeLecture?.id);
    const next = allLectures[idx + 1];
    if (activeLecture) {
      setProgressMap((prev) => ({
        ...prev,
        [activeLecture.id]: { watchedSeconds: activeLecture.videoDuration ?? 0, isCompleted: true },
      }));
    }
    if (next) setTimeout(() => goToLecture(next), 1500);
  }, [activeLecture, allLectures, goToLecture]);

  const curriculumProps = {
    course, enrollment, sections, activeLecture, progressMap,
    totalLectures, completedCount, overallProgress,
    expandedSections, setExpanded, goToLecture,
  };

  const activeFmt = activeLecture ? getLectureFormat(activeLecture) : "video";
  const nextLecture = activeLecture
    ? allLectures[allLectures.findIndex((l) => l.id === activeLecture.id) + 1] ?? null
    : null;

  const formatLabel = activeFmt === "live" ? "Live session"
    : activeFmt === "in_person" ? "In-person"
    : "Video lecture";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">

      {/* ── TOP HEADER ───────────────────────────────────────────────────── */}
      <header className="flex h-[54px] flex-shrink-0 items-center justify-between border-b border-surface-100 bg-white px-5 z-10">
        {/* Left */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-gray-500 hover:bg-surface-100 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div className="h-4 w-px bg-surface-200" />
          <span className="hidden max-w-[260px] truncate text-[13px] text-gray-500 sm:block">
            {course.title}
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700 sm:inline">
            Online · Video
          </span>
          <div className="flex items-center gap-2">
            <div className="h-1 w-20 rounded-full bg-surface-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <span className="text-[12px] font-semibold text-brand-600 w-8 text-right">
              {overallProgress}%
            </span>
          </div>
          {/* Mobile hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 lg:hidden"
          >
            <Menu size={17} />
          </button>
        </div>
      </header>

      {/* ── BODY ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Desktop sidebar */}
        <aside className="hidden w-[290px] flex-shrink-0 flex-col border-r border-surface-100 bg-white overflow-hidden lg:flex">
          <Curriculum {...curriculumProps} />
        </aside>

        {/* Mobile drawer overlay */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* Mobile drawer */}
        <div className={cn(
          "fixed inset-y-0 left-0 z-50 w-[290px] max-w-[85vw] flex flex-col bg-white border-r border-surface-100",
          "transform transition-transform duration-300 lg:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex items-center justify-between border-b border-surface-100 px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">Course Content</span>
            <button
              onClick={() => setDrawerOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <Curriculum {...curriculumProps} onSelect={() => setDrawerOpen(false)} />
          </div>
        </div>

        {/* ── Main content ───────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-white">

          {activeLecture ? (
            <>
              {/* Video / placeholder */}
              <div className="flex-shrink-0 bg-surface-50 border-b border-surface-100" style={{ height: "52%" }}>
                {activeLecture.videoUrl ? (
                  <VideoPlayer
                    lectureId={activeLecture.id}
                    videoUrl={activeLecture.videoUrl}
                    title={activeLecture.title}
                    initialSeconds={activeProgress?.watchedSeconds ?? 0}
                    onComplete={handleLectureComplete}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-brand-200 bg-brand-50">
                      <PlayCircle size={22} className="text-brand-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-medium text-gray-600">Video coming soon</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">This lecture will be available shortly</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Lecture info panel */}
              <div className="flex-1 overflow-y-auto px-7 py-5" style={{ scrollbarWidth: "none" }}>
                <div className="max-w-3xl">

                  {/* Type badge + duration */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand-700">
                      <FormatIcon format={activeFmt} size={11} />
                      {formatLabel}
                    </span>
                    {activeLecture.videoDuration && (
                      <span className="text-[11px] text-gray-400">
                        {formatDuration(Math.round(activeLecture.videoDuration / 60))}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h1 className="font-display text-[19px] font-semibold text-gray-900 leading-snug mb-4">
                    {activeLecture.title}
                  </h1>

                  {/* Description */}
                  {activeLecture.description && (
                    <p className="text-[13px] text-gray-500 leading-relaxed mb-5 whitespace-pre-line">
                      {activeLecture.description}
                    </p>
                  )}

                  {/* Next up card */}
                  {nextLecture && (
                    <button
                      onClick={() => goToLecture(nextLecture)}
                      className="flex w-full items-center justify-between rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 hover:bg-surface-100 hover:border-surface-300 transition-colors mb-4"
                    >
                      <div className="text-left">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                          Next up
                        </p>
                        <p className="text-[12px] font-medium text-gray-900">{nextLecture.title}</p>
                      </div>
                      <ArrowRight size={15} className="flex-shrink-0 text-gray-400 ml-4" />
                    </button>
                  )}

                  {/* Completion */}
                  {!nextLecture && overallProgress >= 100 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center mb-4">
                      <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-500" />
                      <p className="text-[13px] font-semibold text-emerald-800 mb-2">
                        You&apos;ve completed this course!
                      </p>
                      <a
                        href={`/api/enrollments/${enrollment.id}/certificate`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 hover:underline"
                      >
                        <Download size={12} /> Download certificate
                      </a>
                    </div>
                  )}

                  {/* Resource chips */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { icon: <FileText size={13} />, label: "Lecture notes" },
                      { icon: <Download size={13} />, label: "Exercise files" },
                      { icon: <Code2 size={13} />,   label: "Code on GitHub" },
                    ].map(({ icon, label }) => (
                      <button
                        key={label}
                        className="flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-[11px] text-gray-500 hover:border-surface-300 hover:text-gray-800 transition-colors"
                      >
                        {icon} {label}
                      </button>
                    ))}
                  </div>

                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-center p-8">
              <div>
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-surface-200 bg-surface-50 mx-auto mb-4">
                  <PlayCircle size={28} className="text-brand-400" />
                </div>
                <p className="text-[15px] font-semibold text-gray-900 mb-1">Ready to start?</p>
                <p className="text-[13px] text-gray-400">Select a lecture from the sidebar.</p>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="mt-4 text-[12px] font-medium text-brand-600 hover:underline lg:hidden"
                >
                  Browse course content →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
