import { AnalyticsService } from "@/services/analytics.service";
export const revalidate = 60; // Refresh earnings every 60 seconds

import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/Card";
import { PurchaseStatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, TrendingUp, Users, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tutorId = session.user.id;

  const {
    allTimeEarnings,
    monthEarnings,
    weekEarnings,
    totalStudents,
    recentPayouts,
    topCourses,
    stripe,
  } = await AnalyticsService.getInstructorEarnings(tutorId);

  const isPayoutsEnabled = stripe.payoutsEnabled ?? false;

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Instructor" }, { label: "Earnings" }]} />

      <div className="p-6 space-y-8">
        {/* Stripe Connect banner */}
        {!isPayoutsEnabled && (
          <div className="flex items-center justify-between rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-4">
            <div>
              <p className="font-semibold text-amber-800">Set up payouts to get paid</p>
              <p className="mt-0.5 text-sm text-amber-600">
                Connect your bank account via Stripe to receive your earnings.
              </p>
            </div>
            <Link href="/instructor/onboarding">
              <Button variant="primary" size="sm">Set up payouts</Button>
            </Link>
          </div>
        )}

        <div>
          <h1 className="heading-1 text-gray-900">Earnings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your revenue share after the platform fee.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="All-time earnings"
            value={formatCurrency(allTimeEarnings)}
            icon={<CreditCard size={20} />}
          />
          <StatCard
            label="Last 30 days"
            value={formatCurrency(monthEarnings)}
            delta="vs previous month"
            deltaType="up"
            icon={<TrendingUp size={20} />}
          />
          <StatCard
            label="Last 7 days"
            value={formatCurrency(weekEarnings)}
            icon={<TrendingUp size={20} />}
          />
          <StatCard
            label="Total students"
            value={totalStudents ?? 0}
            icon={<Users size={20} />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          {/* Transaction history */}
          <div className="xl:col-span-3">
            <h2 className="heading-3 text-gray-900 mb-4">Recent Transactions</h2>
            <div className="table-container">
              {recentPayouts.length === 0 ? (
                <p className="p-8 text-center text-sm text-gray-400">
                  No transactions yet. Once students enrol, payments will appear here.
                </p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Course</th>
                      <th className="table-header">Sale</th>
                      <th className="table-header">Your cut</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayouts.map((row) => (
                      <tr key={row.id} className="table-row">
                        <td className="table-cell max-w-[180px] truncate font-medium text-gray-900">
                          {row.courseTitle ?? "—"}
                        </td>
                        <td className="table-cell text-gray-500">
                          {formatCurrency(Number(row.amount))}
                        </td>
                        <td className="table-cell font-semibold text-emerald-600">
                          {formatCurrency(Number(row.tutorAmount))}
                        </td>
                        <td className="table-cell">
                          <PurchaseStatusBadge status={row.status} />
                        </td>
                        <td className="table-cell text-gray-400">
                          {formatDate(row.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Top courses */}
          <div className="xl:col-span-2">
            <h2 className="heading-3 text-gray-900 mb-4">Top Courses</h2>
            <div className="card p-0 overflow-hidden">
              {topCourses.length === 0 ? (
                <p className="p-6 text-sm text-gray-400 text-center">No data yet.</p>
              ) : (
                <div className="divide-y divide-surface-100">
                  {topCourses.map((c, i) => (
                    <div key={c.courseId} className="flex items-center gap-4 px-4 py-3.5">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-surface-100 text-xs font-bold text-gray-400">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{c.courseTitle}</p>
                        <p className="text-xs text-gray-400">{c.students} students</p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">
                        {formatCurrency(Number(c.total ?? 0))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payout info */}
            {isPayoutsEnabled && (
              <div className="mt-4 card p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Payout Info
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Schedule</span>
                  <span className="font-medium text-gray-900">Weekly · Fridays</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Your share</span>
                  <span className="font-medium text-gray-900">80%</span>
                </div>
                <Link href="/instructor/onboarding" className="block">
                  <Button variant="ghost" size="sm" className="w-full mt-2">
                    Manage Stripe account
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
