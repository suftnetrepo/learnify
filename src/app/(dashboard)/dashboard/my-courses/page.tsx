import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EnrollmentService } from "@/services/enrollment.service";
import { SessionService } from "@/services/session.service";
import { Topbar } from "@/components/layout/Topbar";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BookOpen, ArrowRight } from "lucide-react";
import { MyCoursesList } from "./MyCoursesList";

export const metadata: Metadata = { title: "My Courses | Learnify" };

type Filter = "all" | "in-progress" | "completed";

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function MyCoursesPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { filter: rawFilter } = await searchParams;
  const filter: Filter =
    rawFilter === "in-progress" || rawFilter === "completed" ? rawFilter : "all";

  const [{ enrolled }, allSessions] = await Promise.all([
    EnrollmentService.getDashboardData(session.user.id),
    SessionService.getStudentSessions(session.user.id),
  ]);
  const now = new Date();

  const inProgressCount = enrolled.filter((e) => !e.completedAt && Number(e.progress) > 0).length;
  const completedCount  = enrolled.filter((e) => !!e.completedAt).length;

  const filtered = enrolled.filter((e) => {
    if (filter === "in-progress") return !e.completedAt && Number(e.progress) > 0;
    if (filter === "completed")   return !!e.completedAt;
    return true;
  });

  const TABS: { key: Filter; label: string; count: number }[] = [
    { key: "all",         label: "All",         count: enrolled.length },
    { key: "in-progress", label: "In Progress", count: inProgressCount },
    { key: "completed",   label: "Completed",   count: completedCount },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <Topbar
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "My Courses" }]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
          {/* Header */}
          <div>
            <h1 className="font-display text-2xl font-extrabold text-gray-900">My Courses</h1>
            <p className="mt-1 text-sm text-gray-400">
              {enrolled.length} course{enrolled.length === 1 ? "" : "s"} enrolled
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((tab) => {
              const isActive = filter === tab.key;
              const href = tab.key === "all" ? "/dashboard/my-courses" : `/dashboard/my-courses?filter=${tab.key}`;
              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-500 text-white"
                      : "border border-surface-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700"
                  )}
                >
                  {tab.label}
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    isActive ? "bg-white/20" : "bg-surface-100 text-gray-500"
                  )}>
                    {tab.count}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Courses grid */}
          {filtered.length > 0 ? (
            <MyCoursesList enrolled={filtered} allSessions={allSessions} now={now} />
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-surface-200 p-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 mx-auto mb-5">
                <BookOpen size={28} className="text-brand-500" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">
                {filter === "all" ? "No courses yet" : `No ${filter === "in-progress" ? "in-progress" : "completed"} courses`}
              </h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
                {filter === "all"
                  ? "Browse our catalogue of expert-led courses and start learning today."
                  : "Courses matching this filter will show up here."}
              </p>
              <Link
                href="/courses"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                Browse Courses <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
