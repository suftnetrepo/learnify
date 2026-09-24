"use client";

import { StudyMindPanel, type CourseData } from "@studymind/react";
import { Loader2 } from "lucide-react";
import { useStudyMindSession } from "./useStudyMindSession";

interface Props {
  courseId:   string;
  courseData: CourseData;
}

/**
 * Tutor/admin view of the StudyMind panel for the course editor. Its Materials
 * tab uploads notes and PDFs that every enrolled student's AI tutor can use.
 */
export function StudyMindMaterials({ courseId, courseData }: Props) {
  const { session, loading, error, retry } = useStudyMindSession(courseId);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">AI Study Materials</h3>
        <p className="mt-1 text-xs text-gray-500">
          Upload course notes and PDFs in the <strong>Materials</strong> tab below. Enrolled
          students can ask the AI tutor about anything in these documents.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="mr-2 animate-spin text-brand-500" />
          <span className="text-sm text-gray-500">Connecting…</span>
        </div>
      ) : error || !session ? (
        <div className="py-8 text-center">
          <p className="text-sm text-red-500">{error ?? "Couldn't connect to StudyMind"}</p>
          <button onClick={retry} className="mt-2 text-xs font-medium text-brand-600 hover:underline">
            Retry
          </button>
        </div>
      ) : (
        <StudyMindPanel
          courseId={courseId}
          userId={session.userId}
          userRole={session.role}
          courseData={courseData}
          sessionToken={session.sessionToken}
          apiUrl={session.apiUrl}
          className="max-w-lg"
          onError={(e) => console.error("StudyMind error:", e)}
        />
      )}
    </div>
  );
}
