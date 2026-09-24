"use client";

import { useCallback, useEffect, useState } from "react";

export interface StudyMindSession {
  sessionToken: string;
  expiresAt:    string;
  apiUrl:       string;
  userId:       string;
  role:         "student" | "tutor" | "admin";
}

async function requestSession(courseId: string): Promise<StudyMindSession> {
  const res  = await fetch("/api/studymind/session", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ courseId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to connect to the AI tutor");
  return data as StudyMindSession;
}

/** Fetches a short-lived StudyMind session token for the signed-in user and course. */
export function useStudyMindSession(courseId: string) {
  const [session, setSession] = useState<StudyMindSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    requestSession(courseId)
      .then((s) => { if (!cancelled) { setSession(s); setError(null); } })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to connect to the AI tutor");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId, attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { session, loading, error, retry };
}
