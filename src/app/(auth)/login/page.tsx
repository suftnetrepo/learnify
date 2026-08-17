import { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign In — Learnify" };

export default function LoginPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
        Welcome back
      </h1>
      <p className="mt-1.5 text-sm text-gray-500">
        Sign in to continue to your account.
      </p>
      <div className="mt-7">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-100" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
