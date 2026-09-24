"use client";

import { StudyMindPanel, type CourseData } from "@studymind/react";
import { Loader2 } from "lucide-react";
import { useStudyMindSession } from "./useStudyMindSession";

interface Props {
  courseId:   string;
  courseData: CourseData;
}

/**
 * AI tutor for the course player's right sidebar. The panel ships as a fixed-size
 * card, so the `!` overrides make it fill the sidebar edge to edge instead.
 */
export function StudyMindSidebar({ courseId, courseData }: Props) {
  const { session, loading, error, retry } = useStudyMindSession(courseId);

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <Loader2 size={24} className="animate-spin text-brand-500" />
        <p className="text-sm text-gray-500">Connecting to AI…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm text-red-500">{error ?? "Couldn't connect to the AI tutor"}</p>
        <button onClick={retry} className="text-xs font-medium text-brand-600 hover:underline">
          Try again
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
