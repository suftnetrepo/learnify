import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="p-6 max-w-2xl space-y-2">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="mt-8 h-56 w-full rounded-2xl" />
    </div>
  );
}
