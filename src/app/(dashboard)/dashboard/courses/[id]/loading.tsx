import { Skeleton } from "@/components/ui/Skeleton";

export default function CourseViewerLoading() {
  return (
    <div className="flex h-screen bg-surface-950">
      <div className="hidden w-80 flex-shrink-0 lg:flex flex-col bg-surface-900 border-r border-white/10">
        <div className="p-5 border-b border-white/10 space-y-3">
          <Skeleton className="h-4 w-3/4 bg-white/10" />
          <Skeleton className="h-2 w-full bg-white/10" />
        </div>
        <div className="flex-1 p-3 space-y-1.5">
          {[...Array(8)].map((_,i) => <Skeleton key={i} className="h-10 rounded-lg bg-white/5" />)}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <Skeleton className="w-full aspect-video max-h-[55vh] rounded-none bg-gray-900" />
        <div className="flex-1 bg-surface-900 p-6 space-y-4">
          <Skeleton className="h-7 w-2/3 bg-white/10" />
          <Skeleton className="h-4 w-full bg-white/10" />
          <Skeleton className="h-4 w-4/5 bg-white/10" />
        </div>
      </div>
    </div>
  );
}
