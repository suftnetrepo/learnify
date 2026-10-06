"use client";

import { RotateCw } from "lucide-react";
import { useTutorInviteResend } from "@/hooks/useTutors";

interface Props { email: string }

export function ResendInviteButton({ email }: Props) {
  const { resend, resending } = useTutorInviteResend();

  return (
    <button
      onClick={() => resend(email)}
      disabled={resending}
      title={`Resend invitation to ${email}`}
      aria-label={`Resend invitation to ${email}`}
      className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50 hover:text-brand-600 transition-colors disabled:opacity-50"
    >
      <RotateCw size={14} className={resending ? "animate-spin" : ""} />
    </button>
  );
}
