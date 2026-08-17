import { Topbar } from "@/components/layout/Topbar";
import { StatCardsSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Payments" }]} />
      <div className="p-6 space-y-8">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-surface-100" />
        <StatCardsSkeleton count={3} />
        <TableSkeleton rows={15} cols={8} />
      </div>
    </div>
  );
}
