/** Shape of GET /api/ai-pass/status (enabled: true). */
export interface AiPassPeriod { passId: string; startsAt: string; endsAt: string }

export interface AiPassFeatureUsage { limit: number; used: number; remaining: number; available: boolean }

export interface AiPassStatus {
  enabled: boolean;
  offer: {
    pricePence:   number;
    currency:     string;
    durationDays: number;
    allowances:   Record<"chat" | "quiz" | "flashcards" | "summary", number>;
    maxQueued:    number;
  };
  current?:         AiPassPeriod | null;
  queued?:          AiPassPeriod[];
  last?:            (AiPassPeriod & { state: string }) | null;
  canPurchaseMore?: boolean;
  usage?: {
    status:           "active" | "expired" | "revoked";
    resets_at:        string;
    features:         Record<"chat" | "quiz" | "flashcards" | "summary", AiPassFeatureUsage>;
    budget_exhausted: boolean;
  } | null;
  usageAvailable?: boolean;
  /** Recent payments that couldn't become a pass, and what happens to the money. */
  rejectedPayments?: { at: string; reason: string | null; refundStatus: string }[];
}

export const FEATURE_LABELS = {
  chat:       "AI tutor questions",
  quiz:       "Practice quizzes",
  flashcards: "Flashcard sets",
  summary:    "Lecture summaries",
} as const;

export function formatPrice(pence: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency.toUpperCase() }).format(pence / 100);
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function fetchAiPassStatus(): Promise<AiPassStatus> {
  const res = await fetch("/api/ai-pass/status", { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message ?? "Couldn't load your AI Tutor Pass");
  return (body?.data ?? body) as AiPassStatus;
}
