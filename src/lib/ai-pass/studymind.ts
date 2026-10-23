/**
 * Server-to-server calls to StudyMind's usage-policy endpoints (API key never leaves the server).
 * StudyMind creates a policy when Learnify first mints a pass token, and enforces it from then on.
 */
const DEFAULT_API_URL = "https://api.aismartlearner.com";

function config() {
  const apiKey = process.env.STUDYMIND_API_KEY;
  if (!apiKey) throw new Error("StudyMind not configured");
  return { apiKey, apiUrl: (process.env.STUDYMIND_API_URL || DEFAULT_API_URL).replace(/\/$/, "") };
}

export interface StudyMindPolicyStatus {
  pass_id:          string;
  status:           "active" | "expired" | "revoked";
  expires_at:       string;
  usage_date:       string;
  resets_at:        string;
  features:         Record<"chat" | "quiz" | "flashcards" | "summary", { limit: number; used: number; remaining: number; available: boolean }>;
  budget_exhausted: boolean;
}

/** The pass's live usage, or null when StudyMind has no policy for it yet (first use creates it). */
export async function getPolicyStatus(passId: string, userId: string): Promise<StudyMindPolicyStatus | null> {
  const { apiKey, apiUrl } = config();
  const qs = new URLSearchParams({ pass_id: passId, user_id: userId });
  const res = await fetch(`${apiUrl}/api/v1/usage/policy?${qs}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache:   "no-store",
    signal:  AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`StudyMind usage status failed (${res.status})`);
  return (await res.json()) as StudyMindPolicyStatus;
}

/**
 * Revoke the pass's StudyMind policy. "no_policy" means StudyMind never created one (the pass was
 * never used) — nothing left to revoke. Throws on anything else so the caller retries later.
 */
export async function revokePolicy(passId: string, userId: string, reason: string): Promise<"revoked" | "no_policy"> {
  const { apiKey, apiUrl } = config();
  const res = await fetch(`${apiUrl}/api/v1/usage/policy/revoke`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ pass_id: passId, user_id: userId, reason }),
    cache:   "no-store",
    signal:  AbortSignal.timeout(10_000),
  });
  if (res.ok) return "revoked";
  const body = await res.json().catch(() => ({}));
  if (res.status === 404 && body?.code === "policy_not_found") return "no_policy";
  throw new Error(`StudyMind revoke failed (${res.status}${body?.code ? ` ${body.code}` : ""})`);
}
