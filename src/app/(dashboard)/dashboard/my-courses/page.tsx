import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EnrollmentService } from "@/services/enrollment.service";
import { Topbar } from "@/components/layout/Topbar";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BookOpen, Trophy, Award, ArrowRight, PlayCircle } from "lucide-react";

export const metadata: Metadata = { title: "My Courses | Learnify" };

const THUMB_GRADIENTS = [
  "from-indigo-700 to-brand-500",
  "from-sky-700 to-cyan-500",
  "from-emerald-700 to-teal-500",
  "from-violet-700 to-purple-500",
  "from-rose-700 to-pink-500",
  "from-amber-700 to-orange-500",
];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

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

  const { enrolled } = await EnrollmentService.getDashboardData(session.user.id);

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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((e) => {
                const gradient   = THUMB_GRADIENTS[hashStr(e.courseId) % THUMB_GRADIENTS.length];
                const progress   = Number(e.progress);
                const isComplete = !!e.completedAt;

                return (
                  <div
                    key={e.enrollmentId}
                    className="flex flex-col rounded-2xl border border-surface-100 bg-white overflow-hidden hover:border-brand-200 hover:shadow-sm transition-all"
                  >
                    {/* Thumbnail */}
                    <div className={`relative h-[110px] w-full bg-gradient-to-br ${gradient} overflow-hidden`}>
                      {e.courseThumbnail ? (
                        <Image
                          src={e.courseThumbnail}
                          alt={e.courseTitle ?? ""}
                          fill
                          sizes="(max-width: 640px) 100vw, 33vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <BookOpen size={24} className="text-white/30" />
                        </div>
                      )}

                      {isComplete && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white">
                            <Trophy size={12} /> Completed
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex flex-1 flex-col p-4">
                      {e.categoryName && (
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1">
                          {e.categoryName}
                        </p>
                      )}
                      <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 flex-1 leading-snug mb-3">
                        {e.courseTitle}
                      </h3>

                      {!isComplete ? (
                        <div className="mb-3 flex items-center gap-2.5">
                          <div className="flex-1 h-1 rounded-full bg-surface-100 overflow-hidden">
                            <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-gray-400 flex-shrink-0">
                            {progress > 0 ? `${progress}%` : "Not started"}
                          </span>
                        </div>
                      ) : (
                        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                          <Award size={12} /> Certificate earned
                        </div>
                      )}

                      <Link
                        href={`/learn/${e.courseId}`}
                        className="flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
                      >
                        <PlayCircle size={15} />
                        Continue
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
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
