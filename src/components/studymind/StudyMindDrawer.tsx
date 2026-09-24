"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { CourseData } from "@studymind/react";
import { StudyMindMaterials } from "./StudyMindMaterials";

interface Props {
  courseId:   string;
  /** Must come from loadStudyMindCourseData — the same outline the course player sends. */
  courseData: CourseData;
}

/**
 * Floating "AI Materials" tab on the right edge of the course editor that opens a
 * slide-in drawer with the StudyMind panel (tutors/admins get its Materials tab).
 * The panel mounts on first open and then stays mounted, so closing the drawer
 * doesn't interrupt an upload or throw away the session.
 */
export function StudyMindDrawer({ courseId, courseData }: Props) {
  const [open,   setOpen]   = useState(false);
  const [opened, setOpened] = useState(false);

  const toggle = () => {
    setOpen((o) => !o);
    setOpened(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Floating toggle — fixed to the right edge */}
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-controls="studymind-drawer"
        title="StudyMind AI Materials"
        className="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl bg-brand-500 px-2 py-4 text-white shadow-lg transition-colors hover:bg-brand-600"
      >
        <Sparkles size={16} />
        <span className="rotate-180 text-xs font-semibold tracking-wide [writing-mode:vertical-lr]">
          AI Materials
        </span>
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} aria-hidden />
      )}

      {/* Slide-in drawer */}
      <div
        id="studymind-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="StudyMind AI Materials"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out sm:w-[420px] ${
          open ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-surface-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-500" />
            <span className="text-sm font-semibold text-gray-900">AI Materials</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-surface-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <p className="flex-shrink-0 border-b border-surface-100 px-5 py-3 text-xs text-gray-500">
          Upload course notes and PDFs in the <strong>Materials</strong> tab. Students enrolled in
          this course can ask the AI tutor about anything in them.
        </p>

        <div className="flex min-h-0 flex-1 flex-col">
          {opened && <StudyMindMaterials courseId={courseId} courseData={courseData} />}
        </div>
      </div>
    </>
  );
}
