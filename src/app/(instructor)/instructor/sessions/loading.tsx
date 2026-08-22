import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
