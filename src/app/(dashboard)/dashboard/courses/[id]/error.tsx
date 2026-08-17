"use client";
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function CourseError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-surface-950 text-white p-8 text-center">
      <AlertCircle size={40} className="mb-4 text-red-400" />
      <h2 className="font-display text-xl font-bold mb-2">Could not load course</h2>
      <p className="text-gray-400 text-sm mb-6 max-w-sm">
        There was a problem loading this course. This is usually temporary.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="secondary">Try again</Button>
        <Link href="/dashboard"><Button variant="ghost" className="text-gray-300">Back to dashboard</Button></Link>
      </div>
    </div>
  );
}
