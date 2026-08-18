import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EnrollmentService } from "@/services/enrollment.service";
import { Topbar } from "@/components/layout/Topbar";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpen, Clock, Trophy, Award,
  ArrowRight, PlayCircle, ChevronRight,
} from "lucide-react";

export const metadata: Metadata = { title: "Dashboard | Learnify" };

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

const LEVEL_COLORS: Record<string, string> = {
  beginner:     "bg-emerald-100 text-emerald-700",
  intermediate: "bg-violet-100 text-violet-700",
  advanced:     "bg-red-100 text-red-700",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (session.user.role === "tutor") redirect("/instructor/courses");

  const userId   = session.user.id;
  const { enrolled: myEnrollments, stats } = await EnrollmentService.getDashboardData(userId);

  const inProgress       = myEnrollments.filter((e) => Number(e.progress) > 0 && !e.completedAt);
  const notStarted       = myEnrollments.filter((e) => Number(e.progress) === 0 && !e.completedAt);
  const completedCourses = myEnrollments.filter((e) => !!e.completedAt);
  const firstName        = session.user.name?.split(" ")[0] ?? "there";
  const initials         = session.user.name
    ? session.user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const topContinue = inProgress[0] ?? notStarted[0] ?? null;

  const statCards = [
    { label: "Enrolled",    value: myEnrollments.length,   icon: BookOpen, iconBg: "bg-brand-50",   iconColor: "text-brand-600" },
    { label: "In progress", value: inProgress.length,      icon: Clock,    iconBg: "bg-amber-50",   iconColor: "text-amber-600" },
    { label: "Completed",   value: completedCourses.length, icon: Trophy,  iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { label: "Certificates", value: completedCourses.length, icon: Award,  iconBg: "bg-violet-50",  iconColor: "text-violet-600" },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Topbar with actions */}
      <Topbar
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <Link
            href="/courses"
            className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
          >
            Browse courses <ArrowRight size={14} />
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 sm:p-7 space-y-7 max-w-6xl">

          {/* ── Greeting ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-base font-bold text-white">
                {initials}
              </div>
              <div>
                <h1 className="font-display text-xl font-extrabold text-gray-900 sm:text-2xl">
                  Welcome back, {firstName} 👋
                </h1>
                <p className="text-sm text-gray-400">
                  {inProgress.length > 0
                    ? `${inProgress.length} course${inProgress.length > 1 ? "s" : ""} in progress`
                    : "Let's continue your learning journey."}
                </p>
              </div>
            </div>
            <Link
              href="/courses"
              className="sm:hidden inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              Browse <ArrowRight size={12} />
            </Link>
          </div>

          {/* ── Stats ────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statCards.map(({ label, value, icon: Icon, iconBg, iconColor }) => (
              <div key={label} className="rounded-2xl border border-surface-100 bg-white p-4 sm:p-5">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} mb-3`}>
                  <Icon size={18} className={iconColor} />
                </div>
                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                <p className="font-display text-3xl font-extrabold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {/* ── Continue Learning ─────────────────────────────────── */}
          {topContinue && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-base font-bold text-gray-900">Continue learning</h2>
              </div>
              <Link
                href={`/dashboard/courses/${topContinue.courseId}`}
                className="group flex items-center gap-4 rounded-2xl border border-surface-100 bg-white p-4 hover:border-brand-200 hover:shadow-sm transition-all"
              >
                {/* Thumbnail */}
                <div className={`relative h-16 w-24 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br ${THUMB_GRADIENTS[hashStr(topContinue.courseId) % THUMB_GRADIENTS.length]}`}>
                  {topContinue.courseThumbnail ? (
                    <Image
                      src={topContinue.courseThumbnail}
                      alt={topContinue.courseTitle ?? ""}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen size={20} className="text-white/50" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-brand-500 mb-0.5">
                    {topContinue.categoryName ?? "Course"}
                  </p>
                  <h3 className="font-semibold text-sm text-gray-900 group-hover:text-brand-600 transition-colors line-clamp-1 mb-2">
                    {topContinue.courseTitle}
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-surface-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${Number(topContinue.progress)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-brand-600 flex-shrink-0 w-8 text-right">
                      {Number(topContinue.progress)}%
                    </span>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex-shrink-0 hidden sm:flex items-center gap-2 rounded-xl bg-brand-500 group-hover:bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
                  <PlayCircle size={15} />
                  Continue
                </div>
              </Link>
            </section>
          )}

          {/* ── Your Courses ──────────────────────────────────────── */}
          {myEnrollments.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-base font-bold text-gray-900">Your courses</h2>
                {myEnrollments.length > 3 && (
                  <Link href="/dashboard" className="text-sm font-medium text-brand-600 hover:underline flex items-center gap-1">
                    View all <ChevronRight size={14} />
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myEnrollments.slice(0, 6).map((e) => {
                  const gradient = THUMB_GRADIENTS[hashStr(e.courseId) % THUMB_GRADIENTS.length];
                  const progress = Number(e.progress);
                  const isComplete = !!e.completedAt;

                  return (
                    <Link
                      key={e.enrollmentId}
                      href={`/dashboard/courses/${e.courseId}`}
                      className="group flex flex-col rounded-2xl border border-surface-100 bg-white overflow-hidden hover:border-brand-200 hover:shadow-sm transition-all"
                    >
                      {/* Thumbnail */}
                      <div className={`relative h-[110px] w-full bg-gradient-to-br ${gradient} overflow-hidden`}>
                        {e.courseThumbnail ? (
                          <Image
                            src={e.courseThumbnail}
                            alt={e.courseTitle ?? ""}
                            fill
                            sizes="(max-width: 640px) 100vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <BookOpen size={24} className="text-white/30" />
                          </div>
                        )}

                        {/* Level badge */}
                        {e.courseFormat && (
                          <span className="absolute bottom-2 left-2 rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm capitalize">
                            {e.courseFormat.replace("_", "-")}
                          </span>
                        )}

                        {/* Complete badge */}
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
                        <h3 className="font-semibold text-sm text-gray-900 group-hover:text-brand-600 transition-colors line-clamp-2 flex-1 leading-snug mb-3">
                          {e.courseTitle}
                        </h3>

                        {!isComplete ? (
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-1 rounded-full bg-surface-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-gray-400 flex-shrink-0">
                              {progress > 0 ? `${progress}%` : "Not started"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                            <Award size={12} /> Certificate earned
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Empty state ───────────────────────────────────────── */}
          {myEnrollments.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-surface-200 p-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 mx-auto mb-5">
                <BookOpen size={28} className="text-brand-500" />
              </div>
              <h3 className="font-display text-xl font-bold text-gray-900 mb-2">No courses yet</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
                Browse our catalogue of expert-led courses and start learning today.
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
