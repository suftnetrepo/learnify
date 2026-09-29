"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { RecaptchaProvider } from "@/lib/recaptcha";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function AuthInput({
  id, label, type = "text", placeholder, value, onChange,
  autoComplete, required, disabled, leftElement, rightElement, error,
}: {
  id: string; label: string; type?: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string; required?: boolean; disabled?: boolean;
  leftElement?: React.ReactNode; rightElement?: React.ReactNode; error?: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-slate-700">
        {label}
      </label>
      <div className={cn(
        "relative flex h-12 items-center overflow-hidden rounded-xl border bg-white transition-all duration-200",
        error     ? "border-red-400 ring-1 ring-red-100"         :
        focused   ? "border-brand-400 ring-2 ring-brand-100"     :
        "border-surface-200 hover:border-surface-300"
      )}>
        {leftElement && (
          <div className="pointer-events-none absolute left-3.5 flex items-center text-slate-400">
            {leftElement}
          </div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "h-full w-full bg-transparent px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50",
            leftElement && "pl-10",
            rightElement && "pr-11",
            "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a]"
          )}
        />
        {rightElement && (
          <div className="absolute right-3 flex items-center">{rightElement}</div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle size={11} />{error}
        </p>
      )}
    </div>
  );
}

function LoginFormInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl  = searchParams.get("callbackUrl") ?? "/dashboard";

  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState("");
  const [fields,   setFields]   = useState({ email: "", password: "" });

  const set = (k: "email" | "password") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email:    fields.email,
      password: fields.password,
      redirect: false,
    });

    if (result?.error) {
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Global error */}
      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <AuthInput
          id="email" label="Email address" type="email"
          placeholder="name@example.com" value={fields.email}
          onChange={set("email")} autoComplete="email" required
          leftElement={<Mail size={16} />}
        />
        <AuthInput
          id="password" label="Password" type={showPass ? "text" : "password"}
          placeholder="Enter your password" value={fields.password}
          onChange={set("password")} autoComplete="current-password" required
          leftElement={<Lock size={16} />}
          rightElement={
            <button type="button" tabIndex={-1} onClick={() => setShowPass(!showPass)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />
      </div>

      {/* Forgot password */}
      <div className="mt-2 flex justify-end">
        <Link href="/forgot-password"
          className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline transition-colors">
          Forgot password?
        </Link>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !fields.email || !fields.password}
        className={cn(
          "mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl",
          "bg-brand-500 text-sm font-semibold text-white shadow-sm hover:bg-brand-600",
          "transition-all duration-150 hover:opacity-90 active:scale-[0.98]",
          "disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        )}
      >
        {loading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : null}
        {loading ? "Signing in…" : "Sign in"}
      </button>

      {/* Divider */}
      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-surface-100" />
        <span className="text-xs text-gray-400">or</span>
        <div className="h-px flex-1 bg-surface-100" />
      </div>

      {/* Sign up link */}
      <p className="mt-5 text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700 hover:underline transition-colors">
          Create one free
        </Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  return (
    <RecaptchaProvider>
      <LoginFormInner />
    </RecaptchaProvider>
  );
}
