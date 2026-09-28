"use client";

import { useCallback, useEffect, useState } from "react";

export interface StudyMindSession {
  sessionToken: string;
  expiresAt:    string;
  /** Token lifetime in seconds, counted from when it was received. */
  expiresIn:    number;
  /** Client time (ms) the token was received — set here, not by the server. */
  receivedAt:   number;
  apiUrl:       string;
  userId:       string;
  role:         "student" | "tutor" | "admin";
}

/** Refresh this long before the token expires. */
const REFRESH_BEFORE_MS = 5 * 60 * 1000;
/** Retry a failed refresh after this long (the current token keeps working meanwhile). */
const REFRESH_RETRY_MS  = 30 * 1000;
/** Never refresh more often than this, whatever the token lifetime says. */
const MIN_REFRESH_GAP_MS = 60 * 1000;

class SessionError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function requestSession(courseId: string): Promise<StudyMindSession> {
  const res  = await fetch("/api/studymind/session", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ courseId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SessionError(data.error || "Failed to connect to the AI tutor", res.status);
  return { ...data, receivedAt: Date.now() } as StudyMindSession;
}

/**
 * Short-lived StudyMind session token for the signed-in user and course, refreshed
 * automatically before it expires. <StudyMindPanel> swaps a refreshed token in without
 * resetting, so the chat keeps going past the token's 1-hour lifetime.
 */
export function useStudyMindSession(courseId: string) {
  const [session, setSession] = useState<StudyMindSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Initial connection (and manual retries)
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

  // Refresh ahead of expiry. Scheduled from the token's lifetime and when it arrived — not the
  // server's absolute expiry vs. this device's clock, which may be wrong (a clock running fast
  // would otherwise make every new token look nearly expired and refresh in a loop).
  // Timers are throttled in background tabs, so also check when the tab becomes visible again.
  useEffect(() => {
    if (!session) return;
    const lifetimeMs = (session.expiresIn || 0) * 1000;
    if (lifetimeMs <= 0) return;
    const refreshAt = session.receivedAt + Math.max(MIN_REFRESH_GAP_MS, lifetimeMs - REFRESH_BEFORE_MS);

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      clearTimeout(timer);
      requestSession(courseId)
        .then((s) => { if (!cancelled) setSession(s); })   // new expiry → this effect reschedules
        .catch((e: unknown) => {
          if (cancelled) return;
          // 4xx (signed out, lost access) won't fix itself; anything else is retried
          if (e instanceof SessionError && e.status >= 400 && e.status < 500) return;
          timer = setTimeout(refresh, REFRESH_RETRY_MS);
        });
    };

    timer = setTimeout(refresh, Math.max(0, refreshAt - Date.now()));

    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() >= refreshAt) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, courseId]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  return { session, loading, error, retry };
}
