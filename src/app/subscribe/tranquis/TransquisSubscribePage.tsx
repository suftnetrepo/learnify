"use client";

import { useState } from "react";
import { TRANQUIS_PLANS } from "@/lib/tranquis-plans";

// ── Plan card ─────────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: typeof TRANQUIS_PLANS[number];
  userId: string;
}

function PlanCard({ plan, userId }: PlanCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const isAnnual  = plan.id === "annual";
  const isMonthly = plan.id === "monthly";

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tranquis/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ planId: plan.id, userId }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Something went wrong");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setLoading(false);
    }
  }

  return (
    <div
      className={[
        "relative rounded-2xl border-2 bg-white p-6 transition-shadow",
        isAnnual
          ? "border-indigo-500 shadow-lg shadow-indigo-100"
          : "border-gray-100 hover:border-indigo-200 hover:shadow-md",
      ].join(" ")}
    >
      {/* Badges */}
      {plan.badge && (
        <span
          className={[
            "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold",
            isAnnual
              ? "bg-indigo-600 text-white"
              : "bg-violet-100 text-violet-700",
          ].join(" ")}
        >
          {plan.badge}
        </span>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
          {plan.description && (
            <p className="mt-0.5 text-sm text-gray-500">{plan.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className="text-2xl font-bold text-gray-900">{plan.priceDisplay}</span>
          <span className="block text-xs text-gray-400">{plan.intervalLabel}</span>
        </div>
      </div>

      {isMonthly && (
        <p className="mt-3 text-xs text-violet-600 font-medium">
          First 7 days free — cancel any time
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>
      )}

      <button
        onClick={handleSubscribe}
        disabled={loading}
        aria-label={`Subscribe to ${plan.name} at ${plan.priceDisplay} ${plan.intervalLabel}`}
        className={[
          "mt-4 w-full rounded-xl py-3 px-4 text-sm font-semibold transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
          loading
            ? "cursor-not-allowed bg-gray-100 text-gray-400"
            : isAnnual
            ? "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800"
            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200",
        ].join(" ")}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Redirecting…
          </span>
        ) : (
          "Subscribe"
        )}
      </button>
    </div>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

interface Props {
  userId: string | null;
}

export function TransquisSubscribePage({ userId }: Props) {
  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100">
            <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Link not recognised</h1>
          <p className="text-gray-500 text-sm">
            Please open this link from the Tranquis app to subscribe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      {/* Header */}
      <header className="border-b border-indigo-100 bg-white/70 backdrop-blur px-6 py-4 text-center">
        <div className="mx-auto flex max-w-sm items-center justify-center gap-2">
          <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
          </svg>
          <span className="text-lg font-bold text-indigo-700 tracking-tight">Tranquis</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Choose Your Tranquis Plan
          </h1>
          <p className="mt-2 text-gray-500 text-sm sm:text-base">
            Translate freely, anywhere in the world
          </p>
        </div>

        {/* Plan cards */}
        <div className="space-y-4">
          {TRANQUIS_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} userId={userId} />
          ))}
        </div>

        {/* Features */}
        <ul className="mt-8 space-y-2 text-sm text-gray-500">
          {[
            "Unlimited translations",
            "Offline access",
            "All 50+ languages",
            "Cancel any time",
          ].map((feat) => (
            <li key={feat} className="flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-500 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              {feat}
            </li>
          ))}
        </ul>

        {/* Stripe footer */}
        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-gray-400">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Secure payment powered by Stripe
        </div>
      </main>
    </div>
  );
}
