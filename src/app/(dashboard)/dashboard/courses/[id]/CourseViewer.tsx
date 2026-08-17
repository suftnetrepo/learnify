"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight,
  Download, Lock, PlayCircle, Menu, X, BookOpen,
} from "lucide-react";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { Button } from "@/components/ui/Button";
import { cn, formatDuration } from "@/lib/utils";

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

// ─── Curriculum sidebar — shared between desktop and mobile drawer ─────────────
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
  onSelect?:        () => void; // close drawer on mobile
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Course title + progress */}
      <div className="border-b border-white/10 px-5 py-4 flex-shrink-0">
        <h2 className="font-display font-semibold text-sm text-white leading-snug line-clamp-2">
          {course.title}
        </h2>
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-400">Progress</span>
            <span className="text-xs font-medium text-brand-400">{overallProgress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/10">
            <div
              className="h-1.5 rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            {completedCount} / {totalLectures} completed
          </p>
        </div>
      </div>

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => {
          const sectionCompleted = section.lectures.every((l) => progressMap[l.id]?.isCompleted);
          const isExpanded       = expandedSections[section.id] ?? true;

          return (
            <div key={section.id}>
              <button
                onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {sectionCompleted
                    ? <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-400" />
                    : <div className="h-3.5 w-3.5 flex-shrink-0 rounded-full border border-white/20" />
                  }
                  <span className="text-xs font-semibold text-gray-200 truncate">{section.title}</span>
                </div>
                {isExpanded
                  ? <ChevronDown size={14} className="text-gray-500 flex-shrink-0" />
                  : <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />
                }
              </button>

              {isExpanded && section.lectures.map((lecture) => {
                const prog     = progressMap[lecture.id];
                const isActive = lecture.id === activeLecture?.id;
                const isDone   = prog?.isCompleted;

                return (
                  <button
                    key={lecture.id}
                    onClick={() => { goToLecture(lecture); onSelect?.(); }}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-2.5 text-left transition-colors",
                      isActive
                        ? "bg-brand-600/20 border-l-2 border-brand-500"
                        : "hover:bg-white/5 border-l-2 border-transparent"
                    )}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isDone
                        ? <CheckCircle2 size={16} className="text-emerald-400" />
                        : isActive
                        ? <PlayCircle size={16} className="text-brand-400" />
                        : <Circle size={16} className="text-gray-600" />
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-xs leading-relaxed line-clamp-2",
                        isActive ? "font-medium text-white" : "text-gray-400"
                      )}>
                        {lecture.title}
                      </p>
                      {lecture.videoDuration && (
                        <p className="mt-0.5 text-xs text-gray-600">
                          {formatDuration(Math.round(lecture.videoDuration / 60))}
                        </p>
                      )}
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
        <div className="border-t border-white/10 p-4 flex-shrink-0">
          <a href={`/api/enrollments/${enrollment.id}/certificate`} target="_blank">
            <Button className="w-full" size="sm" leftIcon={<Download size={14} />}>
              Download Certificate
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Main viewer ──────────────────────────────────────────────────────────────
export function CourseViewer({
  course, enrollment, sections,
  activeLecture: initialLecture, activeProgress,
  progressMap: initialProgressMap, totalLectures,
}: Props) {
  const router = useRouter();
  const [activeLecture,     setActiveLecture]  = useState(initialLecture);
  const [progressMap,       setProgressMap]    = useState(initialProgressMap);
  const [expandedSections,  setExpanded]       = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map((s) => [s.id, true]))
  );
  const [drawerOpen,        setDrawerOpen]     = useState(false);

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

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950 text-white">

      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-80 flex-shrink-0 flex-col border-r border-white/10 bg-surface-900 overflow-hidden">
        <Curriculum {...curriculumProps} />
      </aside>

      {/* ── Mobile drawer overlay ─────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ───────────────────────────────────────────── */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] flex flex-col bg-surface-900",
        "transform transition-transform duration-300 ease-in-out lg:hidden",
        drawerOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-brand-400" />
            <span className="text-sm font-semibold text-white">Course Content</span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <Curriculum {...curriculumProps} onSelect={() => setDrawerOpen(false)} />
        </div>
      </div>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">

        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b border-white/10 bg-surface-900 px-4 py-2 lg:hidden flex-shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 transition-colors"
            aria-label="Open curriculum"
          >
            <Menu size={18} />
          </button>
          <p className="text-sm font-medium text-gray-200 truncate flex-1">
            {activeLecture?.title ?? course.title}
          </p>
          <span className="flex-shrink-0 text-xs font-medium text-brand-400">
            {overallProgress}%
          </span>
        </div>

        {activeLecture ? (
          <>
            {/* Video player */}
            <div className="flex-shrink-0 bg-black">
              {activeLecture.videoUrl ? (
                <VideoPlayer
                  lectureId={activeLecture.id}
                  videoUrl={activeLecture.videoUrl}
                  title={activeLecture.title}
                  initialSeconds={activeProgress?.watchedSeconds ?? 0}
                  onComplete={handleLectureComplete}
                  className="w-full aspect-video max-h-[55vh]"
                />
              ) : (
                <div className="flex aspect-video max-h-[55vh] w-full items-center justify-center bg-gray-900">
                  <div className="text-center px-4">
                    <Lock size={32} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-sm text-gray-500">No video available for this lecture</p>
                  </div>
                </div>
              )}
            </div>

            {/* Lecture info */}
            <div className="flex-1 overflow-y-auto bg-surface-900 px-4 py-5 sm:px-6">
              <div className="max-w-3xl">
                <h1 className="font-display text-lg font-bold text-white sm:text-xl">
                  {activeLecture.title}
                </h1>
                {activeLecture.description && (
                  <p className="mt-3 text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                    {activeLecture.description}
                  </p>
                )}

                {/* Next lecture */}
                {(() => {
                  const idx  = allLectures.findIndex((l) => l.id === activeLecture.id);
                  const next = allLectures[idx + 1];
                  return next ? (
                    <div className="mt-6">
                      <Button
                        variant="secondary"
                        size="sm"
                        rightIcon={<ChevronRight size={14} />}
                        onClick={() => goToLecture(next)}
                        className="border-white/20 text-gray-300 hover:bg-white/10 hover:text-white"
                      >
                        <span className="hidden sm:inline">Next: </span>
                        <span className="line-clamp-1">{next.title}</span>
                      </Button>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center p-8">
            <div>
              <PlayCircle size={48} className="mx-auto mb-4 text-gray-700" />
              <p className="text-gray-500">Select a lecture to begin</p>
              <button
                onClick={() => setDrawerOpen(true)}
                className="mt-4 text-sm font-medium text-brand-400 hover:underline lg:hidden"
              >
                Browse course content →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
