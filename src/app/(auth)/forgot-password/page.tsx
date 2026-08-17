"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { RecaptchaProvider, useRecaptcha } from "@/lib/recaptcha";
import { cn } from "@/lib/utils";

function ForgotPasswordForm() {
  const [email,     setEmail]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const getToken = useRecaptcha("password_reset");
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const recaptchaToken = await getToken();

      const res  = await fetch("/api/auth/forgot-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, recaptchaToken }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-4">
          <CheckCircle2 size={28} className="text-emerald-600" />
        </div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Check your inbox</h1>
        <p className="mt-3 text-sm text-gray-500">
          If <strong>{email}</strong> is linked to a Learnify account, you&apos;ll receive
          a password reset link within a few minutes.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button onClick={() => setSent(false)} className="text-brand-600 hover:underline font-medium">
            try again
          </button>.
        </p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
        Forgot your password?
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        Enter your email address and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="relative">
          <div className={cn(
            "flex items-center rounded-xl border transition-all",
            "border-surface-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100"
          )}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="h-12 w-full bg-transparent px-4 text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
            <Mail size={16} className="mr-3 flex-shrink-0 text-gray-300" />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-xl",
            "bg-brand-500 text-sm font-semibold text-white shadow-sm",
            "hover:bg-brand-600 transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>

        <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={13} /> Back to sign in
        </Link>
      </form>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <RecaptchaProvider>
      <ForgotPasswordForm />
    </RecaptchaProvider>
  );
}
