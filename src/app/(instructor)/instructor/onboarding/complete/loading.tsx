import { Skeleton } from "@/components/ui/Skeleton";

// Matches the real page's own full-viewport centered layout (it isn't wrapped
// in the usual Topbar + content flow — see onboarding/complete/page.tsx).
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 p-6">
      <div className="max-w-md w-full text-center flex flex-col items-center">
        <Skeleton className="mb-6 h-20 w-20 rounded-full" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/4" />
        <div className="mt-8 flex gap-3">
          <Skeleton className="h-11 w-36 rounded-xl" />
          <Skeleton className="h-11 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
