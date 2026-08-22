import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-surface-100 bg-white overflow-hidden">
            <Skeleton className="h-[130px] w-full rounded-none" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
