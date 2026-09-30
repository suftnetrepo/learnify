import { Metadata } from "next";
import Link from "next/link";
import { AnalyticsService, PaymentService, ReviewService, UserService } from "@/services";
import { StatCard } from "@/components/ui/Card";
import { Topbar } from "@/components/layout/Topbar";
import { BookOpen, Users, CreditCard, GraduationCap, ClipboardCheck, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { RecentPurchasesTable } from "./RecentPurchasesTable";
import { RecentUsersTable } from "./RecentUsersTable";

export const metadata: Metadata = { title: "Admin Dashboard" };

export default async function AdminDashboardPage() {
  const [stats, recentPurchases, recentUsers, reviewCounts] = await Promise.all([
    AnalyticsService.getAdminDashboardStats(),
    PaymentService.getRecentPurchases(5),
    UserService.list({ limit: 5 }),
    ReviewService.counts(),
  ]);

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Dashboard" }]} />
      <div className="p-4 sm:p-6 space-y-8">
        <div>
          <h1 className="heading-1 text-gray-900">Overview</h1>
          <p className="mt-1 text-sm text-gray-500">Everything happening on Edquis, at a glance.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total Revenue"     value={formatCurrency(stats.totalRevenue)}       delta={`${formatCurrency(stats.monthRevenue)} this month`} deltaType="up"     icon={<CreditCard size={20} />} />
          <StatCard label="Total Students"    value={stats.totalUsers.toLocaleString()}         icon={<Users      size={20} />} />
          <StatCard label="Total Enrollments" value={stats.totalEnrollments.toLocaleString()}   icon={<GraduationCap size={20} />} />
          <StatCard label="Live Courses"      value={`${stats.publishedCourses} / ${stats.totalCourses}`}
            delta={stats.pendingTutors > 0 ? `${stats.pendingTutors} tutor${stats.pendingTutors > 1 ? "s" : ""} pending` : undefined}
            deltaType={stats.pendingTutors > 0 ? "down" : "neutral"}
            icon={<BookOpen size={20} />} />

          {/* Course review — replaces the old sidebar "Review" link */}
          <Link
            href="/admin/courses/pending"
            aria-label={`Course review: ${stats.pendingReviewCourses} pending`}
            className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <StatCard
              label="Course Review"
              value={stats.pendingReviewCourses}
              delta={stats.pendingReviewCourses > 0
                ? `Course${stats.pendingReviewCourses > 1 ? "s" : ""} awaiting approval →`
                : "All caught up →"}
              deltaType="neutral"
              icon={<ClipboardCheck size={20} />}
              className={cn(
                "h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-md",
                stats.pendingReviewCourses > 0
                  ? "border-2 border-amber-200 bg-amber-50 group-hover:border-amber-300"
                  : "group-hover:border-brand-200"
              )}
            />
          </Link>

          {/* Student reviews — moderation lives on /admin/reviews */}
          <Link
            href="/admin/reviews"
            aria-label={`Student reviews: ${reviewCounts.all} total`}
            className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <StatCard
              label="Student Reviews"
              value={reviewCounts.all}
              delta={[
                reviewCounts.hidden   ? `${reviewCounts.hidden} hidden` : null,
                reviewCounts.lowRated ? `${reviewCounts.lowRated} low-rated` : null,
              ].filter(Boolean).join(" · ") + (reviewCounts.hidden || reviewCounts.lowRated ? " →" : "Moderate reviews →")}
              deltaType="neutral"
              icon={<MessageSquareText size={20} />}
              className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-brand-200 group-hover:shadow-md"
            />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <RecentPurchasesTable purchases={recentPurchases} />
          <RecentUsersTable users={recentUsers.users} />
        </div>
      </div>
    </div>
  );
}
