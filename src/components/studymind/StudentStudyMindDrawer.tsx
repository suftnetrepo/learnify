"use client";

import { Sparkles } from "lucide-react";
import type { CourseData } from "@studymind/react";
import { SlideOverDrawer } from "./SlideOverDrawer";
import { StudyMindSidebar } from "./StudyMindSidebar";
import { AiTutorPassPanel } from "@/components/ai-pass/AiTutorPassPanel";

interface Props {
  courseId:   string;
  /**
   * Must come from loadStudyMindCourseData — the same outline the course editor sends.
   * Null only in AI Tutor Pass mode for a student without a current pass (purchase card shown).
   */
  courseData: CourseData | null;
  /** Free course with the AI Tutor Pass enabled: show pass status / purchase inside the drawer. */
  aiPass?: boolean;
  /**
   * Position of the floating button. The course player passes an offset that keeps it
   * clear of the curriculum sidebar (and its certificate button).
   */
  buttonPositionClassName?: string;
}

/** Course player (student): floating "AI Tutor" button that opens the StudyMind panel in a drawer. */
export function StudentStudyMindDrawer({
  courseId, courseData, aiPass = false, buttonPositionClassName = "bottom-6 right-6",
}: Props) {
  return (
    <SlideOverDrawer
      title="AI Tutor"
      icon={<Sparkles size={16} className="text-brand-500" />}
      triggerLabel="Open AI Tutor"
      triggerClassName={`fixed z-40 flex items-center gap-2 rounded-2xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-brand-600 ${buttonPositionClassName}`}
      triggerContent={<><Sparkles size={16} /> AI Tutor</>}
    >
      {aiPass ? (
        <AiTutorPassPanel courseId={courseId} courseData={courseData} />
      ) : (
        courseData && <StudyMindSidebar courseId={courseId} courseData={courseData} />
      )}
    </SlideOverDrawer>
  );
}
