"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 mb-6">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <h2 className="heading-2 text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-sm text-gray-500 mb-2 max-w-sm">
        An unexpected error occurred. Our team has been notified.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-300 mb-6 font-mono">Error ID: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <Button onClick={reset} leftIcon={<RefreshCw size={15} />}>Try again</Button>
        <Button variant="secondary" onClick={() => window.location.href = "/admin"}>
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
