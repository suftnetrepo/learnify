import { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Create Account — Learnify" };

export default function RegisterPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-gray-500">
        Join thousands of learners. Free to get started.
      </p>
      <div className="mt-7">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-surface-100" />}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
