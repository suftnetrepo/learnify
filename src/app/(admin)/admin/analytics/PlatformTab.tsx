import { AnalyticsService } from "@/services";
import { StatCard } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DollarSign, Users, ShoppingCart, Star, UserCheck, Award, BookOpen } from "lucide-react";
import { PurchaseStatusBadge } from "@/components/ui/Badge";

function vsPrevious(current: number, previous: number, format: (n: number) => string) {
  if (current === previous) return "no change";
  const diff = current - previous;
  return `${diff > 0 ? "+" : "−"}${format(Math.abs(diff))} vs previous 30 days`;
}

export async function PlatformTab() {
  const [stats, topCourses, recentTransactions] = await Promise.all([
    AnalyticsService.getPlatformStats(),
    AnalyticsService.getTopCourses(8),
    AnalyticsService.getRecentTransactions(12),
  ]);

  const enrolledShare = stats.totalStudents > 0
    ? `${Math.round((stats.enrolledStudents / stats.totalStudents) * 100)}%`
    : "—";

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          delta={`${formatCurrency(stats.monthRevenue)} last 30 days · ${vsPrevious(stats.monthRevenue, stats.prevMonthRevenue, formatCurrency)}`}
          deltaType={stats.revenueTrend}
          icon={<DollarSign size={20} />}
        />
        <StatCard
          label="Total Students"
          value={stats.totalStudents.toLocaleString()}
          delta={`${stats.newStudents} new in 30 days · ${vsPrevious(stats.newStudents, stats.prevNewStudents, String)}`}
          deltaType={stats.studentsTrend}
          icon={<Users size={20} />}
        />
        <StatCard label="Total Enrollments" value={stats.totalEnrollments.toLocaleString()} icon={<ShoppingCart size={20} />} />
        <StatCard
          label="Avg. Rating"
          value={`${stats.avgRating} / 5`}
          delta={`${stats.totalReviews} published reviews · ${stats.publishedCourses} courses live`}
          deltaType="neutral"
          icon={<Star size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: <UserCheck size={18} className="text-brand-500" />,  label: "Enrolled students",      value: enrolledShare, sub: `${stats.enrolledStudents} of ${stats.totalStudents} students have enrolled` },
          { icon: <Award    size={18} className="text-emerald-500" />, label: "Avg. revenue / student", value: stats.totalStudents > 0 ? formatCurrency(stats.totalRevenue / stats.totalStudents) : "—", sub: "Lifetime value" },
          { icon: <BookOpen size={18} className="text-amber-500" />,   label: "Published courses",      value: String(stats.publishedCourses), sub: "Live in catalogue" },
          { icon: <Star     size={18} className="text-violet-500" />,  label: "Reviews collected",      value: String(stats.totalReviews), sub: `Published · avg ${stats.avgRating} stars` },
        ].map(({ icon, label, value, sub }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center gap-2 mb-3">{icon}<span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</span></div>
            <p className="font-display text-2xl font-bold text-gray-900">{value}</p>
            <p className="mt-1 text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <h2 className="heading-3 text-gray-900 mb-4">Top Performing Courses</h2>
          <div className="table-container">
            <table className="w-full min-w-[560px]">
              <thead><tr><th className="table-header">#</th><th className="table-header">Course</th><th className="table-header">Students</th><th className="table-header">Rating</th><th className="table-header">Revenue</th></tr></thead>
              <tbody>
                {topCourses.map((c, i) => (
                  <tr key={c.id} className="table-row">
                    <td className="table-cell"><span className={`flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold ${i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-100 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-surface-100 text-gray-400"}`}>{i + 1}</span></td>
                    <td className="table-cell max-w-[200px]"><p className="font-medium text-gray-900 truncate">{c.title}</p></td>
                    <td className="table-cell text-gray-500">{c.enrollmentCount ?? 0}</td>
                    <td className="table-cell"><div className="flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-400" /><span className="text-sm font-medium text-gray-700">{Number(c.averageRating ?? 0).toFixed(1)}</span></div></td>
                    <td className="table-cell font-semibold text-emerald-600">{formatCurrency(Number(c.revenue ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-2">
          <h2 className="heading-3 text-gray-900 mb-4">Recent Transactions</h2>
          <div className="table-container divide-y divide-surface-100">
            {recentTransactions.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No transactions yet.</p>
            )}
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{tx.courseTitle ?? "—"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tx.studentName ?? "Unknown"} · {formatDate(tx.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(Number(tx.amount))}</span>
                  <PurchaseStatusBadge status={tx.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
