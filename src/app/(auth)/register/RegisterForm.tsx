"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { RecaptchaProvider, useRecaptcha } from "@/lib/recaptcha";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

function FloatingInput({
  id, label, type = "text", placeholder, value, onChange,
  autoComplete, required, disabled, rightElement, hint, error,
}: {
  id: string; label: string; type?: string; placeholder: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string; required?: boolean; disabled?: boolean;
  rightElement?: React.ReactNode; hint?: string; error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;

  return (
    <div className="relative">
      <div className={cn(
        "relative flex items-center rounded-xl border bg-white transition-all duration-200",
        error     ? "border-red-400 ring-1 ring-red-100"       :
        focused   ? "border-brand-400 ring-2 ring-brand-100"   :
        disabled  ? "border-surface-200 bg-surface-50"         :
        "border-surface-200 hover:border-surface-300"
      )}>
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
          placeholder=" "
          className={cn(
            "peer h-14 w-full px-4 pt-5 pb-1 text-sm text-gray-900 bg-transparent [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_white] [&:-webkit-autofill]:[-webkit-text-fill-color:#111827]",
            "placeholder-transparent outline-none",
            "disabled:cursor-not-allowed disabled:text-gray-400"
          )}
        />
        <label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute left-4 font-medium transition-all duration-200",
            focused || filled
              ? "top-2 text-xs text-brand-600"
              : "top-1/2 -translate-y-1/2 text-sm text-gray-400"
          )}
        >
          {label}
        </label>
        {rightElement && (
          <div className="flex flex-shrink-0 items-center pr-3">{rightElement}</div>
        )}
      </div>
      {hint && !error && (
        <p className="mt-1.5 text-xs text-gray-400">{hint}</p>
      )}
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
          <AlertCircle size={11} />{error}
        </p>
      )}
    </div>
  );
}

// Password strength indicator
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: "8+ characters", ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Number", ok: /\d/.test(password) },
  ];
  return (
    <div className="mt-2 flex items-center gap-3">
      {checks.map(({ label, ok }) => (
        <span key={label} className={cn("flex items-center gap-1 text-xs", ok ? "text-emerald-600" : "text-gray-400")}>
          <CheckCircle2 size={10} className={ok ? "text-emerald-500" : "text-gray-300"} />
          {label}
        </span>
      ))}
    </div>
  );
}

function RegisterFormInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token")  ?? undefined;
  const prefillEmail = searchParams.get("email")  ?? "";
  const prefillRole  = searchParams.get("role")   ?? "student";

  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const getToken = useRecaptcha("register");
  const [error,    setError]    = useState("");
  const [fields,   setFields]   = useState({
    name: "", email: prefillEmail, password: "", confirmPassword: "",
  });

  const set = (k: keyof typeof fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (fields.password !== fields.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (fields.password.length < 8 || !/[A-Z]/.test(fields.password) || !/\d/.test(fields.password)) {
      setError("Password must be 8+ characters with an uppercase letter and a number.");
      return;
    }

    setLoading(true);
    try {
      const recaptchaToken = await getToken();

      const res  = await fetch("/api/auth/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:            fields.name,
          email:           fields.email,
          password:        fields.password,
          role:            prefillRole,
          invitationToken: token,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message ?? "Registration failed. Please try again.");
        return;
      }

      // Auto sign-in
      const result = await signIn("credentials", {
        email:    fields.email,
        password: fields.password,
        redirect: false,
      });

      router.push(result?.error ? "/login?registered=1" : "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <AlertCircle size={15} className="mt-0.5 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <FloatingInput
          id="name" label="Full Name"
          placeholder="Alex Rivera" value={fields.name}
          onChange={set("name")} autoComplete="name" required
        />
        <FloatingInput
          id="email" label="Email address" type="email"
          placeholder="you@example.com" value={fields.email}
          onChange={set("email")} autoComplete="email"
          required disabled={!!prefillEmail}
        />
        <div>
          <FloatingInput
            id="password" label="Password" type={showPass ? "text" : "password"}
            placeholder="Min. 8 characters" value={fields.password}
            onChange={set("password")} autoComplete="new-password" required
            rightElement={
              <button type="button" tabIndex={-1} onClick={() => setShowPass(!showPass)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />
          <PasswordStrength password={fields.password} />
        </div>
        <FloatingInput
          id="confirmPassword" label="Confirm Password"
          type={showPass ? "text" : "password"}
          placeholder="Repeat your password" value={fields.confirmPassword}
          onChange={set("confirmPassword")} autoComplete="new-password" required
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !fields.name || !fields.email || !fields.password || !fields.confirmPassword}
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
        {loading ? "Creating account…" : "Create free account"}
      </button>

      {/* Sign in link */}
      <p className="mt-5 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700 hover:underline transition-colors">
          Sign in
        </Link>
      </p>

      {/* Terms */}
      <p className="mt-4 text-center text-xs text-gray-400">
        By signing up you agree to our{" "}
        <Link href="/terms"   className="underline hover:text-gray-600 transition-colors">Terms</Link>
        {" "}and{" "}
        <Link href="/privacy" className="underline hover:text-gray-600 transition-colors">Privacy Policy</Link>.
      </p>
    </form>
  );
}

export function RegisterForm() {
  return (
    <RecaptchaProvider>
      <RegisterFormInner />
    </RecaptchaProvider>
  );
}
