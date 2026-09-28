"use client";

import { Sparkles } from "lucide-react";
import type { CourseData } from "@studymind/react";
import { SlideOverDrawer } from "./SlideOverDrawer";
import { StudyMindMaterials } from "./StudyMindMaterials";

interface Props {
  courseId:   string;
  /** Must come from loadStudyMindCourseData — the same outline the course player sends. */
  courseData: CourseData;
  /** Free course: students don't get the AI tutor, so say so here */
  isFree?:    boolean;
}

/**
 * Course editor (tutor/admin): floating "AI Materials" tab on the right edge that opens
 * the StudyMind panel, whose Materials tab uploads notes and PDFs for the course.
 */
export function StudyMindDrawer({ courseId, courseData, isFree = false }: Props) {
  return (
    <SlideOverDrawer
      title="AI Materials"
      icon={<Sparkles size={16} className="text-brand-500" />}
      triggerLabel="StudyMind AI Materials"
      triggerClassName="fixed right-0 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-2 rounded-l-xl bg-brand-500 px-2 py-4 text-white shadow-lg transition-colors hover:bg-brand-600"
      triggerContent={
        <>
          <Sparkles size={16} />
          <span className="rotate-180 text-xs font-semibold tracking-wide [writing-mode:vertical-lr]">
            AI Materials
          </span>
        </>
      }
      description={
        isFree ? (
          <>
            <strong className="text-amber-700">This course is free, so students don&apos;t get the AI tutor.</strong>{" "}
            You can still upload notes and PDFs here — students will be able to ask the AI tutor about
            them once the course has a price.
          </>
        ) : (
          <>
            Upload course notes and PDFs here. Students enrolled in this course can ask the AI tutor
            about anything in them.
          </>
        )
      }
    >
      <StudyMindMaterials courseId={courseId} courseData={courseData} />
    </SlideOverDrawer>
  );
}
