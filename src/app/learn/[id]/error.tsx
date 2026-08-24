"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center min-h-[300px]">
      <AlertCircle size={40} className="mb-4 text-red-400" />
      <p className="font-display text-lg font-bold text-gray-900 mb-2">
        Something went wrong
      </p>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">
        We hit an unexpected error. Try again or go back to safety.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">Try again</Button>
        <Link href="/">
          <Button>Go home</Button>
        </Link>
      </div>
    </div>
  );
}
