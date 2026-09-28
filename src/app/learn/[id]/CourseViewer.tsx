"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  CheckCircle2, Circle, ChevronDown, ChevronRight, ChevronLeft,
  Download, PlayCircle, Sparkles, Maximize2,
  Video, Clock, FileText, Code2, AlignLeft, StickyNote,
  LayoutDashboard, BookOpen, Award, Calendar, Settings, LogOut,
  Archive, ExternalLink,
} from "lucide-react";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { cn, formatDuration } from "@/lib/utils";
import { initials } from "@/lib/avatar";
import { handoutDisplayName, handoutDownloadPath } from "@/lib/handout";
import { resourcesApi, notesApi } from "@/lib/api-client";
import type { LectureResource, LectureResourceType } from "@/types";
import Link from "next/link";
import { signOut } from "next-auth/react";

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
  // Plain "HH:MM:SS" clock time — no date/timezone component. The section's
  // time slot in the day for in-person/hybrid courses (e.g. "Morning
  // Session, 09:00–11:00"); lectures inside it are just topics, not
  // separately scheduled.
  scheduledStart: string | null;
  scheduledEnd:   string | null;
}

interface ProgressRow {
  watchedSeconds: number;
  isCompleted:    boolean;
}

interface Props {
  course: {
    id:                string;
    title:              string;
    thumbnailUrl:       string | null;
    shortDescription?:  string | null;
    whatYouLearn?:      string | null;
    handoutUrl?:        string | null;
    handoutName?:       string | null;
  };
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
  /** Signed-in student's name for the nav footer */
  studentName?:    string | null;
}

type TabKey = "overview" | "transcript" | "notes" | "resources";

const NAV_ITEMS = [
  { label: "Dashboard",    href: "/dashboard",              icon: <LayoutDashboard size={18} /> },
  { label: "My Courses",   href: "/dashboard/my-courses",   icon: <BookOpen        size={18} /> },
  { label: "Certificates", href: "/dashboard/certificates", icon: <Award           size={18} /> },
  { label: "Calendar",     href: "/dashboard/calendar",     icon: <Calendar        size={18} /> },
  { label: "Settings",     href: "/dashboard/settings",     icon: <Settings        size={18} /> },
];

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "overview",   label: "Overview",   icon: <FileText   size={14} /> },
  { key: "transcript", label: "Transcript", icon: <AlignLeft  size={14} /> },
  { key: "notes",      label: "Notes",      icon: <StickyNote size={14} /> },
  { key: "resources",  label: "Resources",  icon: <Download   size={14} /> },
];

const RESOURCE_TYPE_ICONS: Record<LectureResourceType, React.ReactNode> = {
  pdf:    <FileText     size={16} />,
  zip:    <Archive      size={16} />,
  github: <Code2        size={16} />,
  link:   <ExternalLink size={16} />,
  video:  <Video        size={16} />,
};

function parseWhatYouLearn(json?: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

// scheduledStart/scheduledEnd are plain "HH:MM:SS" clock times (no date, no
// timezone), so this is a straight substring — not a Date/toLocaleTimeString
// conversion, which would silently reinterpret the time through whatever
// timezone happens to run the conversion.
function formatClockTime(t: string) {
  return t.slice(0, 5);
}

export function CourseViewer({
  course, enrollment, sections,
  activeLecture: initialLecture, activeProgress,
  progressMap: initialProgressMap, totalLectures, studentName,
}: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  const [activeLecture, setActiveLecture] = useState(initialLecture);
  const [progressMap,   setProgressMap]   = useState(initialProgressMap);
  const [activeTab,     setActiveTab]     = useState<TabKey>("overview");

  // ─ Resources — feeds the Resources tab AND the "Watch Recording" quick-view
  //   in the video area, so this fetches on every lecture change, not just
  //   when the Resources tab happens to be open.
  const [resources,        setResources]        = useState<LectureResource[]>([]);
  const [loadingResources, setLoadingResources]  = useState(false);

  useEffect(() => {
    if (!activeLecture) { setResources([]); return; }
    setLoadingResources(true);
    resourcesApi.list(activeLecture.id)
      .then(setResources)
      .catch(() => setResources([]))
      .finally(() => setLoadingResources(false));
  }, [activeLecture?.id]);

  // ─ Notes tab — fetch on lecture change, auto-save 1s after typing stops ─────
  // Only the student's own edits are saved, and only into the lecture whose note is loaded:
  // saving on every change used to write the previous lecture's text (or "" after a failed
  // load) over a note when its fetch was slow or failed.
  const [noteContent,   setNoteContent]   = useState("");
  const [noteSaved,     setNoteSaved]     = useState(false);
  const [noteLectureId, setNoteLectureId] = useState<string | null>(null);  // whose note is in the box
  const [noteDirty,     setNoteDirty]     = useState(false);
  const [noteError,     setNoteError]     = useState(false);
  const noteContentRef = useRef(noteContent);
  useEffect(() => { noteContentRef.current = noteContent; }, [noteContent]);

  const activeLectureId = activeLecture?.id ?? null;
  useEffect(() => {
    if (!activeLectureId) return;
    const lectureId = activeLectureId;
    let cancelled = false;
    notesApi.get(lectureId)
      .then((note) => {
        if (cancelled) return;
        setNoteContent(note?.content ?? "");
        setNoteLectureId(lectureId);
        setNoteDirty(false);
        setNoteSaved(false);
        setNoteError(false);
      })
      .catch(() => { if (!cancelled) { setNoteLectureId(null); setNoteError(true); } });
    return () => { cancelled = true; };
  }, [activeLectureId]);

  useEffect(() => {
    if (!noteDirty || !noteLectureId || noteLectureId !== activeLectureId) return;
    const content = noteContent;
    const timer = setTimeout(() => {
      notesApi.save(noteLectureId, content)
        .then(() => {
          setNoteSaved(true);
          if (noteContentRef.current === content) setNoteDirty(false);   // still typing? keep saving
        })
        .catch(() => setNoteSaved(false));
    }, 1000);
    return () => clearTimeout(timer);
  }, [noteContent, noteDirty, noteLectureId, activeLectureId]);

  const noteReady = !!activeLectureId && noteLectureId === activeLectureId;

  const allLectures    = sections.flatMap((s) => s.lectures);
  const initialSection = sections.find((s) =>
    s.lectures.some((l) => l.id === initialLecture?.id)
  ) ?? sections[0];

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map((s) => [s.id, s.id === initialSection?.id]))
  );

  const completedCount  = Object.values(progressMap).filter((p) => p.isCompleted).length;
  const overallProgress = totalLectures > 0
    ? Math.round((completedCount / totalLectures) * 100)
    : 0;

  const goToLecture = useCallback((lecture: Lecture) => {
    setActiveLecture(lecture);
    setActiveTab("overview");
    const section = sections.find((s) => s.lectures.some((l) => l.id === lecture.id));
    if (section) {
      setExpandedSections(Object.fromEntries(sections.map((s) => [s.id, s.id === section.id])));
    }
    router.replace(`/learn/${course.id}?lecture=${lecture.id}`, { scroll: false });
  }, [course.id, router, sections]);

  const handleLectureComplete = useCallback(() => {
    if (!activeLecture) return;
    setProgressMap((prev) => ({
      ...prev,
      [activeLecture.id]: { watchedSeconds: activeLecture.videoDuration ?? 0, isCompleted: true },
    }));
    const idx  = allLectures.findIndex((l) => l.id === activeLecture.id);
    const next = allLectures[idx + 1];
    if (next) setTimeout(() => goToLecture(next), 1500);
  }, [activeLecture, allLectures, goToLecture]);

  const activeIndex      = activeLecture ? allLectures.findIndex((l) => l.id === activeLecture.id) : -1;
  const previousLecture  = activeIndex > 0 ? allLectures[activeIndex - 1] : null;
  const nextLecture      = activeIndex >= 0 ? allLectures[activeIndex + 1] ?? null : null;
  const whatYouLearn     = parseWhatYouLearn(course.whatYouLearn);

  // A "link" or "video" resource on a lecture with no video of its own is
  // treated as a recording (e.g. the Zoom/Teams recording URL for a live
  // session) and gets a prominent quick-view instead of the plain placeholder.
  const recordingResource = resources.find((r) => r.type === "link" || r.type === "video");
  const isZoom             = recordingResource?.url.includes("zoom.us");
  const isTeams            = recordingResource?.url.includes("teams.microsoft.com");
  const platformLabel      = isZoom ? "Zoom" : isTeams ? "Microsoft Teams" : "Recording";

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const isCoursePage = pathname?.startsWith("/learn") ?? false;
  const activeHref = isCoursePage
    ? "/dashboard/my-courses"
    : NAV_ITEMS
        .map((item) => item.href)
        .filter((href) => pathname === href || pathname?.startsWith(href + "/"))
        .sort((a, b) => b.length - a.length)[0];

  return (
    // Desktop (lg+): nav | lecture | curriculum columns, each scrolling on its own.
    // Phones/tablets: no left nav (the header links back to My Courses); lecture and curriculum
    // stack in one scrolling column. 100dvh keeps it inside mobile browser chrome.
    <div className="flex h-[100dvh] overflow-hidden bg-white">

      {/* ── LEFT NAV SIDEBAR ────────────────────────────────────────────── */}
      <aside className="hidden h-full w-[220px] flex-shrink-0 flex-col border-r border-surface-100 bg-white lg:flex">
        <Link href="/dashboard" className="flex h-16 flex-shrink-0 items-center gap-2.5 border-b border-surface-100 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
            <Sparkles size={15} className="text-white" />
          </div>
          <span className="font-display text-[15px] font-bold text-gray-900">Learnify</span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-500 hover:bg-surface-50 hover:text-gray-900"
                )}
              >
                <span className={cn("flex-shrink-0", isActive ? "text-brand-600" : "text-gray-400")}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 border-t border-surface-100 p-3 space-y-1">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={17} className="flex-shrink-0" />
            Sign out
          </button>

          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {initials(studentName ?? "Student")}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-gray-900">{studentName || "Student"}</p>
              <p className="truncate text-[11px] text-gray-400">Signed in</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── RIGHT SECTION ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="h-[52px] flex-shrink-0 flex items-center justify-between gap-3 border-b border-surface-100 bg-white px-4 sm:px-6">
          <Link
            href="/dashboard/my-courses"
            className="flex min-w-0 items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft size={16} className="flex-shrink-0 text-gray-400" />
            <span className="truncate">{course.title}</span>
          </Link>

          <div className="flex flex-shrink-0 items-center gap-3">
            <span className="hidden text-xs text-gray-500 sm:inline">Your progress</span>
            <span className="text-xs font-semibold text-brand-600">{overallProgress}%</span>
            <div className="hidden h-1.5 w-[120px] overflow-hidden rounded-full bg-surface-200 sm:block">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <button
              onClick={toggleFullscreen}
              aria-label="Toggle full screen"
              title="Full screen"
              className="hidden h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 hover:text-gray-700 transition-colors sm:flex"
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </header>

        {/* ── BODY ───────────────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">

          {/* ── CENTRE PANEL ────────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-col lg:min-h-0 lg:flex-1 lg:overflow-hidden">
            {activeLecture ? (
              <>
                {/* Render media only when the lesson has real playable or
                    scheduled media. Written lessons start with their content. */}
                {activeLecture.videoUrl ? (
                  <div className="aspect-video w-full flex-shrink-0 bg-black lg:aspect-auto lg:h-[42%]">
                    <VideoPlayer
                      lectureId={activeLecture.id}
                      videoUrl={activeLecture.videoUrl}
                      title={activeLecture.title}
                      initialSeconds={activeProgress?.watchedSeconds ?? 0}
                      onComplete={handleLectureComplete}
                      className="h-full w-full"
                    />
                  </div>
                ) : recordingResource ? (
                  <div className="flex w-full flex-shrink-0 flex-col items-center justify-center gap-5 bg-gradient-to-br from-surface-50 to-white px-4 py-8 sm:px-8 lg:h-[42%] lg:py-0">
                    <div className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-6 text-center shadow-sm">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-brand-100 bg-brand-50">
                        <PlayCircle size={28} className="text-brand-500" />
                      </div>
                      <p className="mb-1 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-brand-500">
                        <Video size={12} /> {platformLabel} Recording
                      </p>
                      <h3 className="font-display text-base font-semibold text-gray-900 mb-1">
                        {activeLecture.title}
                      </h3>
                      <p className="mb-5 text-xs text-gray-400">
                        This session was recorded. Watch it at your own pace.
                      </p>
                      <a
                        href={recordingResource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
                      >
                        <PlayCircle size={16} /> Watch Recording
                      </a>
                      <p className="mt-3 text-[10px] text-gray-300">
                        Opens in {platformLabel}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Lecture info panel — scrolls independently below the fixed-height video */}
                <div className="px-4 py-4 sm:px-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">

                  {/* Title + prev/next */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-100 pb-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-bold text-gray-900 sm:truncate sm:text-xl">{activeLecture.title}</h2>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <button
                        onClick={() => previousLecture && goToLecture(previousLecture)}
                        disabled={!previousLecture}
                        className="inline-flex items-center gap-1 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                      >
                        <ChevronLeft size={16} /> Previous
                      </button>
                      <button
                        onClick={() => nextLecture && goToLecture(nextLecture)}
                        disabled={!nextLecture}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                      >
                        Next <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Meta chips */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-surface-100 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs text-gray-500">
                      <Clock size={13} />
                      {activeLecture.videoDuration
                        ? formatDuration(Math.round(activeLecture.videoDuration / 60))
                        : "--"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs text-gray-500">
                      {activeLecture.videoUrl ? <Video size={13} /> : <BookOpen size={13} />}
                      {activeLecture.videoUrl ? "Video" : "Guided lesson"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs text-gray-500">
                      Lesson {activeIndex + 1} of {allLectures.length}
                    </span>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-4 overflow-x-auto border-b border-surface-100 sm:gap-6">
                    {TABS.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={cn(
                          "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors",
                          activeTab === tab.key
                            ? "border-brand-500 text-brand-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                      >
                        {tab.icon} {tab.label}
                        {tab.key === "notes" && noteSaved && (
                          <span className="inline-flex items-center gap-1 text-emerald-500">
                            <CheckCircle2 size={13} /> Saved
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="py-6">
                    {activeTab === "overview" && (
                      <div className="max-w-3xl">
                        <h3 className="text-sm font-semibold text-gray-900 mb-2">About this lesson</h3>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-500 mb-6">
                          {activeLecture.description ?? "No description available for this lesson yet."}
                        </p>
                        {whatYouLearn.length > 0 && (
                          <>
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">What you&apos;ll learn</h3>
                            <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
                              {whatYouLearn.map((item, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-brand-500" />
                                  <span className="text-sm text-gray-600">{item}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {activeTab === "transcript" && (
                      <p className="text-sm text-gray-500">
                        Transcript will be available once the video is processed.
                      </p>
                    )}

                    {activeTab === "notes" && (noteError && !noteReady ? (
                      <p className="text-sm text-red-500">
                        Couldn&apos;t load your notes for this lecture. Check your connection and reopen the lecture.
                      </p>
                    ) : (
                      <textarea
                        value={noteReady ? noteContent : ""}
                        disabled={!noteReady}
                        aria-label="Your notes for this lecture"
                        onChange={(e) => { setNoteContent(e.target.value); setNoteSaved(false); setNoteDirty(true); }}
                        placeholder={noteReady ? "Add your notes for this lecture..." : "Loading your notes…"}
                        className="h-full min-h-[240px] w-full resize-none border-none bg-transparent text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none"
                      />
                    ))}

                    {activeTab === "resources" && (
                      loadingResources ? (
                        <p className="text-sm text-gray-400">Loading resources…</p>
                      ) : resources.length === 0 ? (
                        <p className="text-sm text-gray-500">No resources have been added for this lecture yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {resources.map((resource) => (
                            <a
                              key={resource.id}
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={resource.type === "pdf" || resource.type === "zip" || undefined}
                              className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm text-gray-700 hover:border-brand-300 hover:text-brand-600 transition-colors"
                            >
                              {RESOURCE_TYPE_ICONS[resource.type]} {resource.label}
                            </a>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-surface-200 bg-surface-50">
                    <PlayCircle size={28} className="text-brand-400" />
                  </div>
                  <p className="mb-1 text-[15px] font-semibold text-gray-900">Ready to start?</p>
                  <p className="text-[13px] text-gray-400">Select a lecture from the sidebar.</p>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT CURRICULUM SIDEBAR ──────────────────────────────────── */}
          {/* Below lg it stacks under the lecture (extra bottom space clears the floating buttons) */}
          <aside className="flex w-full flex-shrink-0 flex-col border-t border-surface-100 bg-white pb-36 lg:w-[360px] lg:overflow-hidden lg:border-l lg:border-t-0 lg:pb-0 xl:w-[400px] 2xl:w-[440px]">
          <div className="flex-shrink-0 border-b border-surface-100 px-5 py-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
              <AlignLeft size={16} /> Course content
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{completedCount} / {totalLectures} lectures</span>
              <span className="font-semibold text-brand-600">{overallProgress}%</span>
            </div>
            {course.handoutUrl && (
              <a
                href={handoutDownloadPath(course.id)}
                className="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 transition-colors hover:border-emerald-200 hover:bg-emerald-100"
                title="Download the course handbook"
              >
                <FileText size={16} className="flex-shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-emerald-800">Course handbook</span>
                  <span className="block truncate text-[11px] text-emerald-700/80">
                    {handoutDisplayName(course.handoutName, course.handoutUrl)}
                  </span>
                </span>
                <Download size={14} className="flex-shrink-0 text-emerald-700" />
              </a>
            )}
          </div>

          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {sections.map((section, sIdx) => {
              const sectionCompleted = section.lectures.filter((l) => progressMap[l.id]?.isCompleted).length;
              const isExpanded       = expandedSections[section.id] ?? false;

              return (
                <div key={section.id} className="border-b border-surface-100">
                  <button
                    onClick={() => setExpandedSections(
                      Object.fromEntries(sections.map((s) => [s.id, s.id === section.id ? !isExpanded : false]))
                    )}
                    className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left hover:bg-surface-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {sIdx + 1}. {section.title}
                      </p>
                      {section.scheduledStart && (
                        <p className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock size={10} />
                          {formatClockTime(section.scheduledStart)}
                          {section.scheduledEnd && <> – {formatClockTime(section.scheduledEnd)}</>}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {sectionCompleted}/{section.lectures.length}
                      </span>
                      {isExpanded
                        ? <ChevronDown  size={16} className="text-gray-400" />
                        : <ChevronRight size={16} className="text-gray-400" />
                      }
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="pb-2">
                      {section.lectures.map((lecture) => {
                        const prog     = progressMap[lecture.id];
                        const isActive = lecture.id === activeLecture?.id;
                        const isDone   = prog?.isCompleted;

                        return (
                          <button
                            key={lecture.id}
                            onClick={() => goToLecture(lecture)}
                            className={cn(
                              "flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors",
                              isActive ? "bg-brand-50" : "hover:bg-surface-50"
                            )}
                          >
                            {isDone
                              ? <CheckCircle2 size={18} className="flex-shrink-0 text-emerald-500" />
                              : isActive
                              ? <PlayCircle   size={18} className="flex-shrink-0 text-brand-500" />
                              : <Circle       size={18} className="flex-shrink-0 text-gray-300" />
                            }
                            <div className="min-w-0 flex-1">
                              <p className={cn(
                                "truncate text-sm",
                                isActive ? "font-medium text-brand-700" : "text-gray-700"
                              )}>
                                {lecture.title}
                              </p>
                              <p className="text-xs text-gray-400">
                                {lecture.videoDuration
                                  ? formatDuration(Math.round(lecture.videoDuration / 60))
                                  : "--"}
                              </p>
                            </div>
                            {isActive && (
                              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
                                P
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {overallProgress >= 100 && (
            <div className="flex-shrink-0 border-t border-surface-100 p-3">
              <a
                href={`/api/enrollments/${enrollment.id}/certificate`}
                target="_blank"
                className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
              >
                <Download size={13} /> Download Certificate
              </a>
            </div>
          )}
        </aside>
        </div>
      </div>
    </div>
  );
}
