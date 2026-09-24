"use client";

import { StudyMindPanel, type CourseData } from "@studymind/react";
import { Loader2 } from "lucide-react";
import { useStudyMindSession } from "./useStudyMindSession";

interface Props {
  courseId:   string;
  /** Must come from loadStudyMindCourseData — StudyMind re-indexes when this differs. */
  courseData: CourseData;
}

/**
 * Tutor/admin StudyMind panel for the course editor drawer. Its Materials tab
 * uploads notes and PDFs that every enrolled student's AI tutor can use. The
 * panel ships as a fixed-size card, so the `!` overrides make it fill the drawer.
 */
export function StudyMindMaterials({ courseId, courseData }: Props) {
  const { session, loading, error, retry } = useStudyMindSession(courseId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="mr-2 animate-spin text-brand-500" />
        <span className="text-sm text-gray-500">Connecting…</span>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-red-500">{error ?? "Couldn't connect to StudyMind"}</p>
        <button onClick={retry} className="mt-2 text-xs font-medium text-brand-600 hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <StudyMindPanel
      courseId={courseId}
      userId={session.userId}
      userRole={session.role}
      courseData={courseData}
      sessionToken={session.sessionToken}
      apiUrl={session.apiUrl}
      className="!h-full !min-w-0 !max-w-none !rounded-none !border-0 !shadow-none"
      onError={(e) => console.error("StudyMind error:", e)}
    />
  );
}
