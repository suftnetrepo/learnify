"use client";

import { Sparkles } from "lucide-react";
import type { CourseData } from "@studymind/react";
import { SlideOverDrawer } from "./SlideOverDrawer";
import { StudyMindMaterials } from "./StudyMindMaterials";

interface Props {
  courseId:   string;
  /** Must come from loadStudyMindCourseData — the same outline the course player sends. */
  courseData: CourseData;
}

/**
 * Course editor (tutor/admin): floating "AI Materials" tab on the right edge that opens
 * the StudyMind panel, whose Materials tab uploads notes and PDFs for the course.
 */
export function StudyMindDrawer({ courseId, courseData }: Props) {
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
        <>
          Upload course notes and PDFs in the <strong>Materials</strong> tab. Students enrolled in
          this course can ask the AI tutor about anything in them.
        </>
      }
    >
      <StudyMindMaterials courseId={courseId} courseData={courseData} />
    </SlideOverDrawer>
  );
}
