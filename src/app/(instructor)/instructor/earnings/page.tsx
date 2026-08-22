import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { AnalyticsService } from "@/services/analytics.service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BookOpen, Receipt } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Earnings | Instructor" };

export const revalidate = 60; // Refresh earnings every 60 seconds

const THUMB_GRADIENTS = [
  "from-indigo-700 to-brand-500",
  "from-sky-700 to-cyan-500",
  "from-emerald-700 to-teal-500",
];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default async function EarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const {
    allTimeEarnings, monthEarnings, weekEarnings,
    totalStudents, recentPayouts, topCourses, stripe,
  } = await AnalyticsService.getInstructorEarnings(session.user.id);

  const isPayoutsEnabled = stripe.payoutsEnabled ?? false;

  const statCards = [
    { label: "All time",   value: formatCurrency(allTimeEarnings), sub: "Total earned" },
    { label: "This month", value: formatCurrency(monthEarnings),   sub: new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }) },
    { label: "This week",  value: formatCurrency(weekEarnings),    sub: "Last 7 days" },
    { label: "Students",   value: totalStudents,                   sub: "Total enrolled" },
  ];

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Instructor" }, { label: "Earnings" }]} />

      <div className="p-4 sm:p-6 space-y-6">

        {/* Stripe Connect banner */}
        {!isPayoutsEnabled && (
          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 gap-4">
            <div>
              <p className="font-semibold text-amber-800 text-sm">Set up payouts to get paid</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Connect your bank account via Stripe to receive your earnings automatically.
              </p>
            </div>
            <Link href="/instructor/onboarding"
              className="flex-shrink-0 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors whitespace-nowrap">
              Set up payouts
            </Link>
          </div>
        )}

        <div>
          <h1 className="font-display text-2xl font-extrabold text-gray-900">Earnings</h1>
          <p className="mt-1 text-sm text-gray-400">Your revenue share after the platform fee.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map(({ label, value, sub }) => (
            <div key={label} className="rounded-2xl border border-surface-100 bg-white p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="font-display text-2xl font-extrabold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_280px]">

          {/* Recent transactions */}
          <div className="rounded-2xl border border-surface-100 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-sm font-bold text-gray-900">Recent transactions</h2>
              <span className="text-xs font-medium text-brand-600 cursor-pointer hover:underline">
                View all
              </span>
            </div>

            {recentPayouts.length === 0 ? (
              <div className="text-center py-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-50 border border-surface-200 mx-auto mb-3">
                  <Receipt size={20} className="text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-400">No transactions yet</p>
                <p className="text-xs text-gray-300 mt-0.5">
                  Earnings appear here when students enrol in your courses.
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {recentPayouts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-3 border-b border-surface-50 last:border-none">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.courseTitle ?? "—"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.createdAt)}</p>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">
                      +{formatCurrency(p.tutorAmount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top courses */}
          <div className="rounded-2xl border border-surface-100 bg-white p-5">
            <h2 className="font-display text-sm font-bold text-gray-900 mb-4">Top courses</h2>
            {topCourses.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen size={24} className="mx-auto mb-2 text-gray-200" />
                <p className="text-xs text-gray-400">No course data yet</p>
              </div>
            ) : (
              <div className="space-y-0">
                {topCourses.map((c) => {
                  const gradient = THUMB_GRADIENTS[hashStr(c.courseId ?? c.courseTitle ?? "") % THUMB_GRADIENTS.length];
                  return (
                    <div key={c.courseId} className="flex items-center gap-3 py-3 border-b border-surface-50 last:border-none">
                      <div className={cn(
                        "h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br flex items-center justify-center overflow-hidden",
                        gradient
                      )}>
                        {c.thumbnailUrl
                          ? <Image src={c.thumbnailUrl} alt="" width={36} height={36} className="object-cover" />
                          : <BookOpen size={14} className="text-white/40" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{c.courseTitle}</p>
                        <p className="text-[10px] text-gray-400">{c.students} student{c.students !== 1 ? "s" : ""}</p>
                      </div>
                      <span className="text-xs font-semibold text-gray-900 flex-shrink-0">
                        {formatCurrency(c.total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
