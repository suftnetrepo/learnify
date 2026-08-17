import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-100", className)} />;
}

function Bone({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-surface-100", className)} />
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-container">
      <table className="w-full">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="table-header">
                <Bone className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="table-row">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="table-cell">
                  <Bone className={cn("h-4", c === 0 ? "w-40" : c === cols - 1 ? "w-16" : "w-24")} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-4 xl:grid-cols-${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-6 flex items-start justify-between">
          <div className="space-y-2">
            <Bone className="h-2.5 w-20" />
            <Bone className="h-7 w-28" />
            <Bone className="h-2.5 w-32" />
          </div>
          <Bone className="h-11 w-11 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-200 bg-white p-6">
          <div className="flex items-start gap-3 pb-4 border-b border-surface-100 mb-5">
            <Bone className="h-9 w-9 rounded-xl" />
            <div className="space-y-2">
              <Bone className="h-4 w-32" />
              <Bone className="h-3 w-56" />
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Bone className="h-3 w-20 mb-2" />
              <Bone className="h-10 w-full rounded-xl" />
            </div>
            {i === 1 && (
              <div>
                <Bone className="h-3 w-32 mb-2" />
                <Bone className="h-24 w-full rounded-xl" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Bone className="h-8 w-48" />
          <Bone className="h-4 w-32" />
        </div>
        <Bone className="h-10 w-32 rounded-xl" />
      </div>
      <StatCardsSkeleton />
      <TableSkeleton />
    </div>
  );
}
