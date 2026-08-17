import { formatCurrency, formatDate } from "@/lib/utils";
import { PurchaseStatusBadge } from "@/components/ui/Badge";

interface Purchase {
  id: string; amount: string; status: string;
  createdAt: Date; courseTitle: string | null; studentName: string | null;
}

export function RecentPurchasesTable({ purchases }: { purchases: Purchase[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="heading-3 text-gray-900">Recent Purchases</h2>
      </div>
      <div className="table-container">
        <table className="w-full min-w-[560px]">
          <thead><tr><th className="table-header">Student</th><th className="table-header">Course</th><th className="table-header">Amount</th><th className="table-header">Status</th></tr></thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">No purchases yet</td></tr>
            ) : purchases.map((p) => (
              <tr key={p.id} className="table-row">
                <td className="table-cell font-medium text-gray-900">{p.studentName ?? "—"}</td>
                <td className="table-cell text-gray-600 max-w-[140px] truncate">{p.courseTitle ?? "—"}</td>
                <td className="table-cell font-semibold text-gray-900">{formatCurrency(Number(p.amount))}</td>
                <td className="table-cell"><PurchaseStatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
