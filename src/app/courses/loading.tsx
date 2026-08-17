import { Skeleton } from "@/components/ui/Skeleton";

export default function CoursesLoading() {
  return (
    <div>
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      </div>
    </div>
  );
}
