import { Topbar } from "@/components/layout/Topbar";
import { TableSkeleton } from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Courses" }]} />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-32 animate-pulse rounded-lg bg-surface-100" />
            <div className="h-4 w-24 animate-pulse rounded-lg bg-surface-100" />
          </div>
          <div className="h-10 w-32 animate-pulse rounded-xl bg-surface-100" />
        </div>
        <TableSkeleton rows={10} cols={8} />
      </div>
    </div>
  );
}
