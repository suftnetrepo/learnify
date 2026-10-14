import { Metadata } from "next";
import { TRANQUIS_PLANS } from "@/lib/tranquis-plans";

export const metadata: Metadata = { title: "Subscription Active — Tranquis" };

interface Props {
  searchParams: Promise<{ session_id?: string; plan?: string }>;
}

export default async function TransquisSuccessPage({ searchParams }: Props) {
  const { session_id, plan: planId } = await searchParams;

  const plan = TRANQUIS_PLANS.find((p) => p.id === planId) ?? null;
  const deepLink = "tranquis://";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Success icon */}
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-indigo-100">
          <svg className="h-12 w-12 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {"You're all set!"} 🎉
          </h1>
          <p className="mt-2 text-gray-600">
            Your Tranquis Pro subscription is active
          </p>
          {plan && (
            <p className="mt-1 text-sm text-indigo-600 font-medium">
              {plan.name} — {plan.priceDisplay} {plan.intervalLabel}
            </p>
          )}
        </div>

        {/* Auto deep-link + manual button */}
        <script
          dangerouslySetInnerHTML={{
            __html: `setTimeout(function(){ window.location.href = "tranquis://"; }, 800);`,
          }}
        />
        <a
          href={deepLink}
          className="block w-full rounded-xl bg-indigo-600 py-3 px-4 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Return to Tranquis
        </a>

        <p className="text-xs text-gray-400">
          Returning you to the app automatically…
        </p>

        {/* Divider */}
        <div className="border-t border-gray-100 pt-4 space-y-2 text-xs text-gray-400">
          <p>A confirmation email is on its way.</p>
          <div className="flex items-center justify-center gap-2">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
            </svg>
            Tranquis
          </div>
        </div>
      </div>
    </div>
  );
}
