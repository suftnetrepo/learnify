"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

function PasswordStrengthChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={cn("flex items-center gap-1 text-xs", ok ? "text-emerald-600" : "text-gray-400")}>
      <div className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", ok ? "bg-emerald-500" : "bg-gray-200")} />
      {label}
    </span>
  );
}

function ResetForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [done,      setDone]      = useState(false);

  if (!token || !email) {
    return (
      <div className="text-center">
        <AlertCircle size={40} className="mx-auto mb-4 text-red-400" />
        <h1 className="font-display text-xl font-bold text-gray-900">Invalid reset link</h1>
        <p className="mt-2 text-sm text-gray-500">This link is missing required parameters.</p>
        <Link href="/forgot-password" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline">
          Request a new link →
        </Link>
      </div>
    );
  }

  const checks = {
    length:    password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number:    /\d/.test(password),
    match:     password === confirm && confirm.length > 0,
  };
  const allValid = Object.values(checks).every(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allValid) return;
    setLoading(true);
    setError("");

    try {
      const res  = await fetch("/api/auth/reset-password", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, email, password }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 mx-auto mb-4">
          <CheckCircle2 size={28} className="text-emerald-600" />
        </div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Password updated!</h1>
        <p className="mt-2 text-sm text-gray-500">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
        Set a new password
      </h1>
      <p className="mt-2 text-sm text-gray-500">
        For <strong>{email}</strong>
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* New password */}
        <div>
          <div className={cn(
            "flex items-center rounded-xl border transition-all",
            "border-surface-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100"
          )}>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              required
              className="h-14 w-full bg-transparent px-4 pt-4 pb-1 text-sm text-gray-900 outline-none peer"
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPass((v) => !v)}
              className="mr-3 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-2 flex gap-3 flex-wrap">
            <PasswordStrengthChip label="8+ characters" ok={checks.length} />
            <PasswordStrengthChip label="Uppercase"     ok={checks.uppercase} />
            <PasswordStrengthChip label="Number"        ok={checks.number} />
          </div>
        </div>

        {/* Confirm password */}
        <div className={cn(
          "flex items-center rounded-xl border transition-all",
          "border-surface-200 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100",
          confirm.length > 0 && !checks.match && "border-red-400 ring-1 ring-red-100"
        )}>
          <input
            type={showPass ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            required
            className="h-12 w-full bg-transparent px-4 text-sm text-gray-900 outline-none"
          />
        </div>
        {confirm.length > 0 && !checks.match && (
          <p className="text-xs text-red-500 -mt-2">Passwords do not match</p>
        )}

        <button
          type="submit"
          disabled={loading || !allValid}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-xl",
            "bg-brand-500 text-sm font-semibold text-white shadow-sm",
            "hover:bg-brand-600 transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {loading ? "Updating password…" : "Update password"}
        </button>

        <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={13} /> Back to sign in
        </Link>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-100" />}>
      <ResetForm />
    </Suspense>
  );
}
