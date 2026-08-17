import { Topbar } from "@/components/layout/Topbar";
import { StatCardsSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Analytics" }]} />
      <div className="p-6 space-y-8">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-surface-100" />
        <StatCardsSkeleton count={4} />
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3"><TableSkeleton rows={8} cols={5} /></div>
          <div className="xl:col-span-2"><TableSkeleton rows={8} cols={2} /></div>
        </div>
      </div>
    </div>
  );
}
