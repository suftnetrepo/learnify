import { Metadata } from "next";
import Link from "next/link";
import { AnalyticsService, PaymentService, UserService } from "@/services";
import { StatCard } from "@/components/ui/Card";
import { Topbar } from "@/components/layout/Topbar";
import { BookOpen, Users, CreditCard, GraduationCap } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { RecentPurchasesTable } from "./RecentPurchasesTable";
import { RecentUsersTable } from "./RecentUsersTable";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const [stats, recentPurchases, recentUsers] = await Promise.all([
    AnalyticsService.getAdminDashboardStats(),
    PaymentService.getRecentPurchases(5),
    UserService.list({ limit: 5 }),
  ]);

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]} />
      <div className="p-4 sm:p-6 space-y-8">
        <div>
          <h1 className="heading-1 text-gray-900">Platform Overview</h1>
          <p className="mt-1 text-sm text-gray-500">Everything happening on Learnify, at a glance.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Revenue"     value={formatCurrency(stats.totalRevenue)}       delta={`${formatCurrency(stats.monthRevenue)} this month`} deltaType="up"     icon={<CreditCard size={20} />} />
          <StatCard label="Total Students"    value={stats.totalUsers.toLocaleString()}         icon={<Users      size={20} />} />
          <StatCard label="Total Enrollments" value={stats.totalEnrollments.toLocaleString()}   icon={<GraduationCap size={20} />} />
          <StatCard label="Live Courses"      value={`${stats.publishedCourses} / ${stats.totalCourses}`}
            delta={stats.pendingTutors > 0 ? `${stats.pendingTutors} tutor${stats.pendingTutors > 1 ? "s" : ""} pending` : undefined}
            deltaType={stats.pendingTutors > 0 ? "down" : "neutral"}
            icon={<BookOpen size={20} />} />

          {stats.pendingReviewCourses > 0 && (
            <Link href="/admin/courses/pending"
              className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 flex items-center justify-between hover:bg-amber-100 transition-colors">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">Needs attention</p>
                <p className="font-display text-3xl font-extrabold text-amber-800">{stats.pendingReviewCourses}</p>
                <p className="text-sm text-amber-600 mt-0.5">Course{stats.pendingReviewCourses > 1 ? "s" : ""} pending review</p>
              </div>
              <div className="h-3 w-3 rounded-full bg-amber-400 animate-pulse" />
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <RecentPurchasesTable purchases={recentPurchases} />
          <RecentUsersTable users={recentUsers.users} />
        </div>
      </div>
    </div>
  );
}
