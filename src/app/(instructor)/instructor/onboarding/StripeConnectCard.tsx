"use client";

import { CheckCircle2, CreditCard, AlertCircle, Clock, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useStripeConnect } from "@/hooks/useStripe";
import { cn } from "@/lib/utils";

type OnboardingStatus = "not_started" | "in_progress" | "complete" | "restricted";

interface Props {
  status:         OnboardingStatus;
  payoutsEnabled: boolean;
  hasAccount:     boolean;
}

const STATUS_CONFIG = {
  not_started: {
    icon:        <CreditCard size={24} className="text-gray-400" />,
    title:       "Connect your bank account",
    description: "You haven't set up Stripe payouts yet. Connect now to start receiving payments.",
    border:      "border-surface-200 bg-white",
  },
  in_progress: {
    icon:        <Clock size={24} className="text-amber-500" />,
    title:       "Onboarding in progress",
    description: "You've started the process. Continue where you left off.",
    border:      "border-amber-200 bg-amber-50",
  },
  complete: {
    icon:        <CheckCircle2 size={24} className="text-emerald-500" />,
    title:       "Payouts enabled",
    description: "Your Stripe account is connected. You'll receive payments every Friday.",
    border:      "border-emerald-200 bg-emerald-50",
  },
  restricted: {
    icon:        <AlertCircle size={24} className="text-red-500" />,
    title:       "Account restricted",
    description: "There's an issue with your account. Complete the required verification steps.",
    border:      "border-red-200 bg-red-50",
  },
};

export function StripeConnectCard({ status, payoutsEnabled, hasAccount }: Props) {
  const { startOnboarding, loading } = useStripeConnect();
  const cfg = STATUS_CONFIG[status];

  return (
    <div className={cn("rounded-2xl border-2 p-6", cfg.border)}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="heading-3 text-gray-900">{cfg.title}</h3>
          <p className="mt-1 text-sm text-gray-500">{cfg.description}</p>

          {status === "complete" && (
            <div className="mt-4 rounded-xl bg-white border border-emerald-100 p-4 space-y-2">
              {[
                { label: "Payout schedule", value: "Weekly · Every Friday" },
                { label: "Your revenue share", value: "80%" },
                { label: "Payouts enabled", value: payoutsEnabled ? "Yes" : "Pending verification",
                  valueClass: payoutsEnabled ? "text-emerald-600" : "text-amber-600" },
              ].map(({ label, value, valueClass }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{label}</span>
                  <span className={cn("font-medium text-gray-900", valueClass)}>{value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {status === "not_started" && (
              <Button onClick={startOnboarding} loading={loading} leftIcon={<ExternalLink size={15} />} size="lg">
                Connect with Stripe
              </Button>
            )}
            {(status === "in_progress" || status === "restricted") && (
              <Button onClick={startOnboarding} loading={loading} leftIcon={<RefreshCw size={15} />}>
                {status === "in_progress" ? "Continue onboarding" : "Fix account issues"}
              </Button>
            )}
            {status === "complete" && (
              <Button variant="secondary" onClick={startOnboarding} loading={loading} leftIcon={<ExternalLink size={15} />} size="sm">
                Open Stripe dashboard
              </Button>
            )}
          </div>
        </div>
      </div>

      {status === "not_started" && (
        <div className="mt-6 border-t border-surface-100 pt-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">How it works</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { step: "1", text: "Connect your bank account via Stripe's secure onboarding" },
              { step: "2", text: "Students purchase courses — payment goes to Stripe" },
              { step: "3", text: "Your share is transferred to your bank every Friday" },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{step}</div>
                <p className="text-xs text-gray-500 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
