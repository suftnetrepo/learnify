"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 p-8 text-center">
      <AlertCircle size={40} className="mb-4 text-red-400" />
      <h2 className="font-display text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        We couldn&apos;t confirm your Stripe setup. This is usually temporary.
      </p>
      <Button onClick={reset} variant="secondary">Try again</Button>
    </div>
  );
}
