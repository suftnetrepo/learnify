"use client";
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function Error({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <AlertCircle size={40} className="mb-4 text-red-400" />
      <h2 className="font-display text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        This page ran into a problem. It&apos;s usually temporary.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="secondary">Try again</Button>
        <Link href="/login">
          <Button variant="ghost" className="text-gray-500">Go back</Button>
        </Link>
      </div>
    </div>
  );
}
