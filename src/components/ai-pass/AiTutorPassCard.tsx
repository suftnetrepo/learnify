"use client";

import { useState } from "react";
import { Sparkles, Check, CalendarClock, ShieldCheck, Loader2 } from "lucide-react";
import { FEATURE_LABELS, FEATURE_PHRASES, formatDate, formatPrice, type AiPassStatus } from "./types";

interface Props {
  courseId: string;
  status:   AiPassStatus;
  /** "extend" when the student already has a pass and is buying the next one. */
  variant?: "buy" | "extend";
}

/**
 * Purchase card for the free-course AI Tutor Pass.
 *
 * LEGAL REVIEW REQUIRED before launch: the consent wording below (UK Consumer Contracts
 * Regulations 2013, digital content supplied immediately) is a draft.
 */
export function AiTutorPassCard({ courseId, status, variant = "buy" }: Props) {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const { offer } = status;
  const price = formatPrice(offer.pricePence, offer.currency);
  const queued = status.queued ?? [];
  const canBuy = status.canPurchaseMore !== false;

  // A new pass starts when the latest one ends
  const lastEnd = queued.at(-1)?.endsAt ?? status.current?.endsAt ?? null;

  async function buy() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/ai-pass/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ courseId, consent: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.data?.url) throw new Error(body?.message ?? "Couldn't start checkout");
      window.location.assign(body.data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start checkout");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      {variant === "buy" && <PastPassNotice status={status} />}
      <RejectedPaymentNotice status={status} />

      <div className="relative overflow-hidden rounded-2xl bg-gradient-hero p-6 text-white shadow-card">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/30 blur-3xl" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-400">
            <Sparkles size={12} /> AI Tutor Pass
          </span>
          <h3 className="mt-3 text-xl font-semibold leading-snug">
            {variant === "extend" ? "Keep your AI tutor going" : "Your personal AI tutor for free courses"}
          </h3>
          <p className="mt-1 text-sm text-white/70">
            Ask questions, generate quizzes, flashcards and summaries from your course content.
          </p>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{price}</span>
            <span className="text-sm text-white/60">one-time · {offer.durationDays} days · no subscription</span>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Included every day</p>
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(FEATURE_LABELS) as (keyof typeof FEATURE_LABELS)[]).map((k) => (
            <li key={k} className="flex items-center gap-2 rounded-xl border border-surface-100 bg-surface-50 px-3 py-2 text-sm text-gray-700">
              <Check size={14} className="flex-shrink-0 text-emerald-500" />
              <span><strong className="font-semibold text-gray-900">{offer.allowances[k]}</strong> {FEATURE_PHRASES[k]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-gray-500">
          Allowances reset daily at midnight UK time. A fair-use limit also applies. Works on all your free courses.
        </p>
      </div>

      {lastEnd && (
        <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">
          <CalendarClock size={14} className="mt-0.5 flex-shrink-0" />
          This pass will start on {formatDate(lastEnd)}, when your current one ends, and run for {offer.durationDays} days.
        </p>
      )}

      {canBuy ? (
        <>
          {/* DRAFT — pending legal review */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-surface-200 p-3 text-xs leading-relaxed text-gray-600">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              I want access to the AI Tutor Pass to begin {lastEnd ? "as described above" : "immediately"}. I understand that
              once access begins I lose my right to cancel within 14 days.
            </span>
          </label>

          {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

          <button
            onClick={buy}
            disabled={!consent || loading}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {variant === "extend" ? `Add 30 days for ${price}` : `Get AI Tutor Pass · ${price}`}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
            <ShieldCheck size={12} /> Secure payment by Stripe
          </p>
        </>
      ) : (
        <p className="rounded-xl bg-surface-50 px-3 py-2 text-center text-xs text-gray-500">
          You already have {offer.maxQueued} upcoming passes, which is the most you can hold at once.
        </p>
      )}
    </div>
  );
}

function RejectedPaymentNotice({ status }: { status: AiPassStatus }) {
  const latest = status.rejectedPayments?.[0];
  if (!latest) return null;
  const message =
    latest.reason === "queue_full"
      ? latest.refundStatus === "refunded"
        ? `A payment on ${formatDate(latest.at)} arrived after you'd reached the pass limit, so it has been refunded.`
        : `A payment on ${formatDate(latest.at)} arrived after you'd reached the pass limit. We're refunding it.`
      : latest.reason === "invalid"
        ? "We couldn't verify a recent payment. Our team has been alerted and will be in touch."
        : null;
  if (!message) return null;
  return <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">{message}</p>;
}

function PastPassNotice({ status }: { status: AiPassStatus }) {
  const last = status.last;
  if (!last || status.current) return null;
  const message =
    last.state === "expired"  ? `Your last AI Tutor Pass ended on ${formatDate(last.endsAt)}.` :
    last.state === "refunded" ? "Your AI Tutor Pass was refunded, so it's no longer active." :
    last.state === "disputed" ? "Your AI Tutor Pass is paused because the payment is disputed. Contact support for help." :
    null;
  if (!message) return null;
  return <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">{message}</p>;
}
