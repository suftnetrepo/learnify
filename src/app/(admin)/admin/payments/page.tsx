import { Metadata } from "next";
import { PaymentService } from "@/services";
import { Topbar } from "@/components/layout/Topbar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PurchaseStatusBadge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/Card";
import { DollarSign, TrendingUp, RotateCcw, AlertCircle } from "lucide-react";
import { RefundButton } from "./RefundButton";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { PurchaseStatus } from "@/types";

export const metadata: Metadata = { title: "Payments" };

interface Props { searchParams: Promise<{ page?: string; status?: string }> }

export default async function PaymentsPage({ searchParams }: Props) {
  const { page: p, status } = await searchParams;
  const page   = Math.max(1, Number(p ?? 1));

  const [{ purchases, pagination }, stats] = await Promise.all([
    PaymentService.list({ page, limit: 20, status: status as PurchaseStatus | undefined }),
    PaymentService.getStats(),
  ]);

  const STATUS_TABS = ["", "completed", "pending", "refunded", "failed"];
  const LABELS      = { "": "All", completed: "Completed", pending: "Pending", refunded: "Refunded", failed: "Failed" };

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Payments" }]} />
      <div className="p-6 space-y-8">
        <div>
          <h1 className="heading-1 text-gray-900">Payments</h1>
          <p className="mt-1 text-sm text-gray-500">Full transaction ledger — {pagination.total} records</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total Revenue"  value={formatCurrency(stats.totalRevenue)} icon={<DollarSign size={20} />} />
          <StatCard label="Last 30 Days"   value={formatCurrency(stats.monthRevenue)} deltaType="up" icon={<TrendingUp size={20} />} />
          <StatCard label="Refunds Issued" value={String(stats.refundCount)} deltaType={stats.refundCount > 0 ? "down" : "neutral"} icon={<RotateCcw size={20} />} />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_TABS.map((s) => {
            const q = new URLSearchParams(); if (s) q.set("status", s);
            return (
              <Link key={s} href={`/admin/payments?${q}`}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${(status ?? "") === s ? "bg-brand-500 text-white shadow-sm" : "bg-white border border-surface-200 text-gray-600 hover:border-brand-200 hover:text-brand-700"}`}>
                {(LABELS as Record<string,string>)[s]}
              </Link>
            );
          })}
        </div>

        <div className="table-container">
          <table className="w-full min-w-[600px]">
            <thead><tr>
              <th className="table-header">Student</th><th className="table-header">Course</th>
              <th className="table-header">Amount</th><th className="table-header">Platform fee</th>
              <th className="table-header">Tutor cut</th><th className="table-header">Status</th>
              <th className="table-header">Date</th><th className="table-header w-20"></th>
            </tr></thead>
            <tbody>
              {purchases.map((tx) => (
                <tr key={tx.id} className="table-row">
                  <td className="table-cell"><p className="font-medium text-gray-900">{tx.studentName ?? "—"}</p><p className="text-xs text-gray-400">{tx.studentEmail}</p></td>
                  <td className="table-cell max-w-[160px]"><p className="truncate text-gray-700">{tx.courseTitle ?? "—"}</p></td>
                  <td className="table-cell font-semibold text-gray-900">{formatCurrency(Number(tx.amount))}</td>
                  <td className="table-cell text-brand-600">{formatCurrency(Number(tx.platformFee))}</td>
                  <td className="table-cell text-emerald-600">{formatCurrency(Number(tx.tutorAmount))}</td>
                  <td className="table-cell"><PurchaseStatusBadge status={tx.status} /></td>
                  <td className="table-cell text-gray-400 text-xs">{formatDate(tx.createdAt)}{tx.refundedAt && <p className="text-red-400 mt-0.5">Refunded {formatDate(tx.refundedAt)}</p>}</td>
                  <td className="table-cell">
                    {tx.status === "completed" && tx.stripePaymentIntentId && (() => {
                      const daysSince = (Date.now() - new Date(tx.createdAt).getTime()) / (1000*60*60*24);
                      return daysSince <= 30 ? (
                        <RefundButton purchaseId={tx.id} paymentIntentId={tx.stripePaymentIntentId} amount={formatCurrency(Number(tx.amount))} />
                      ) : (
                        <span className="text-xs text-gray-300">Window expired</span>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-surface-100 px-4 py-3">
              <p className="text-xs text-gray-400">Page {page} of {pagination.totalPages}</p>
              <div className="flex gap-2">
                {page > 1 && <Link href={`/admin/payments?page=${page - 1}&status=${status ?? ""}`}><Button variant="outline" size="sm">Previous</Button></Link>}
                {page < pagination.totalPages && <Link href={`/admin/payments?page=${page + 1}&status=${status ?? ""}`}><Button variant="outline" size="sm">Next</Button></Link>}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
          <AlertCircle size={15} className="text-brand-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-brand-700">Payment statuses are updated in real time via Stripe webhooks. Refunds may take 5–10 business days to appear on the student&apos;s statement.</p>
        </div>
      </div>
    </div>
  );
}
