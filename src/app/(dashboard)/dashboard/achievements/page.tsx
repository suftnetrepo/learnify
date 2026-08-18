import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EnrollmentService } from "@/services/enrollment.service";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";
import {
  BookOpen, Trophy, Clock, Flame, GraduationCap, Sparkles, Lock,
} from "lucide-react";

export const metadata: Metadata = { title: "Achievements | Learnify" };

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { enrolled } = await EnrollmentService.getDashboardData(session.user.id);

  const totalEnrolled = enrolled.length;
  const completed     = enrolled.filter((e) => !!e.completedAt).length;
  const inProgress    = enrolled.filter((e) => !e.completedAt && Number(e.progress) > 0).length;
  const totalHours    = Math.round(
    enrolled.reduce((sum, e) => sum + (e.totalDuration ?? 0), 0) / 3600
  );
  const hasHighProgressCourse = enrolled.some((e) => Number(e.progress) > 50);

  const statCards = [
    { label: "Enrolled",    value: totalEnrolled, icon: BookOpen, iconBg: "bg-brand-50",   iconColor: "text-brand-600" },
    { label: "In progress", value: inProgress,    icon: Clock,    iconBg: "bg-amber-50",   iconColor: "text-amber-600" },
    { label: "Completed",   value: completed,     icon: Trophy,   iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { label: "Total hours", value: totalHours,    icon: Flame,    iconBg: "bg-rose-50",    iconColor: "text-rose-600" },
  ];

  const ACHIEVEMENTS = [
    {
      title: "First Enrolment",
      description: "Enrol in your first course",
      icon: BookOpen,
      unlocked: totalEnrolled > 0,
    },
    {
      title: "First Completion",
      description: "Complete your first course",
      icon: Trophy,
      unlocked: completed > 0,
    },
    {
      title: "On a Roll",
      description: "Have more than one course in progress",
      icon: Flame,
      unlocked: inProgress > 1,
    },
    {
      title: "Scholar",
      description: "Complete three or more courses",
      icon: GraduationCap,
      unlocked: completed >= 3,
    },
    {
      title: "Dedicated Learner",
      description: "Reach over 50% progress on a course",
      icon: Sparkles,
      unlocked: hasHighProgressCourse,
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <Topbar
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Achievements" }]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6 space-y-7 max-w-6xl">
          {/* Header */}
          <div>
            <h1 className="font-display text-2xl font-extrabold text-gray-900">Achievements</h1>
            <p className="mt-1 text-sm text-gray-400">Your learning stats and milestones.</p>
          </div>

          {/* Stats */}
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

          {/* Achievements grid */}
          <section>
            <h2 className="font-display text-base font-bold text-gray-900 mb-3">Milestones</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ACHIEVEMENTS.map(({ title, description, icon: Icon, unlocked }) => (
                <div
                  key={title}
                  className={cn(
                    "flex items-start gap-3.5 rounded-2xl border p-5",
                    unlocked
                      ? "border-surface-100 bg-white"
                      : "border-surface-100 bg-surface-50/60"
                  )}
                >
                  <div className={cn(
                    "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
                    unlocked ? "bg-brand-500" : "bg-surface-200"
                  )}>
                    {unlocked
                      ? <Icon size={20} className="text-white" />
                      : <Lock size={18} className="text-gray-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={cn(
                        "font-semibold text-sm",
                        unlocked ? "text-gray-900" : "text-gray-400"
                      )}>
                        {title}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed mb-2.5">{description}</p>
                    {unlocked ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        Unlocked
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-surface-100 px-2.5 py-1 text-[10px] font-bold text-gray-400">
                        Locked
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
