import { Topbar } from "@/components/layout/Topbar";
import { TableSkeleton } from "@/components/ui/Skeleton";
export default function Loading() {
  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Users" }]} />
      <div className="p-6 space-y-6">
        <div className="h-8 w-20 animate-pulse rounded-lg bg-surface-100" />
        <TableSkeleton rows={12} cols={6} />
      </div>
    </div>
  );
}
