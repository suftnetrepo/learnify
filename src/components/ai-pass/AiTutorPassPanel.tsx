"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { CourseData } from "@studymind/react";
import { StudyMindSidebar } from "@/components/studymind/StudyMindSidebar";
import { AiTutorPassCard } from "./AiTutorPassCard";
import { AiPassStatusStrip } from "./AiPassStatusStrip";
import { fetchAiPassStatus, type AiPassStatus } from "./types";

interface Props {
  courseId:   string;
  /** Present when the server granted this student pass access to the course. */
  courseData: CourseData | null;
}

/**
 * Drawer body on a free course with the AI Tutor Pass enabled. Access itself is decided on the
 * server (the page and /api/studymind/session); this only shows status and the purchase card.
 */
export function AiTutorPassPanel({ courseId, courseData }: Props) {
  const [status, setStatus] = useState<AiPassStatus | null>(null);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAiPassStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load your AI Tutor Pass"); });
    return () => { cancelled = true; };
  }, []);

  if (courseData) {
    return (
      <>
        {status && <AiPassStatusStrip courseId={courseId} status={status} />}
        <div className="flex min-h-0 flex-1 flex-col">
          <StudyMindSidebar courseId={courseId} courseData={courseData} />
        </div>
      </>
    );
  }

  if (error) return <p className="p-6 text-center text-sm text-red-500">{error}</p>;
  if (!status) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }
  return <div className="min-h-0 flex-1 overflow-y-auto"><AiTutorPassCard courseId={courseId} status={status} /></div>;
}
