import { log } from "@/lib/logger";

/** Shape of StudyMind's GET /api/v1/usage (self-service stats for our platform API key). */
export interface StudyMindUsage {
  platform:            string;
  total_requests:      number;
  last_used_at:        string | null;
  courses_indexed:     number;
  documents_uploaded:  number;
  total_chunks:        number;
  total_chat_sessions: number;
  total_questions:     number;
  courses: {
    course_id:   string;           // the Edquis course UUID we send as course_id
    title:       string | null;    // null when the course only has uploaded documents
    status:      "ready" | "pending" | "failed";
    chunk_count: number;
    indexed_at:  string | null;
  }[];
}

const DEFAULT_STUDYMIND_API_URL = "https://api.aismartlearner.com";

/**
 * AI usage for Edquis's StudyMind API key, cached for 5 minutes.
 * Returns null when StudyMind isn't configured or can't be reached, so the page can say so.
 */
export async function getStudyMindUsage(): Promise<StudyMindUsage | null> {
  const apiKey = process.env.STUDYMIND_API_KEY;
  const apiUrl = (process.env.STUDYMIND_API_URL || DEFAULT_STUDYMIND_API_URL).replace(/\/$/, "");
  if (!apiKey) return null;

  try {
    const res = await fetch(`${apiUrl}/api/v1/usage`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next:    { revalidate: 300 },
      signal:  AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      log.warn("StudyMind usage request failed", { status: res.status });
      return null;
    }
    return (await res.json()) as StudyMindUsage;
  } catch (error) {
    log.warn("StudyMind usage request errored", { error });
    return null;
  }
}
