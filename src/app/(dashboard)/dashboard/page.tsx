import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EnrollmentService } from "@/services/enrollment.service";
import { SessionService } from "@/services/session.service";
import {
  Search, Bell, ChevronDown, BookOpen, Award, Clock, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { MobileMenuButton } from "./MobileMenuButton";
import { CalendarWidget } from "./CalendarWidget";

export const metadata: Metadata = { title: "Dashboard | Learnify" };

const GRADIENTS = [
  "from-indigo-700 to-brand-500",
  "from-sky-700 to-cyan-500",
  "from-emerald-700 to-teal-500",
  "from-violet-700 to-purple-500",
  "from-rose-700 to-pink-500",
];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "admin") redirect("/admin");
  if (session.user.role === "tutor") redirect("/instructor/courses");

  const userId = session.user.id;

  const [{ enrolled, stats }, allSessions] = await Promise.all([
    EnrollmentService.getDashboardData(userId),
    SessionService.getStudentSessions(userId),
  ]);

  const now      = new Date();
  const todayStr = now.toDateString();

  const liveSessions = allSessions.filter((s) =>
    now >= new Date(s.startDatetime) && now <= new Date(s.endDatetime)
  );
  const todaySessions = allSessions.filter((s) =>
    new Date(s.startDatetime).toDateString() === todayStr
  );

  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const initials  = session.user.name
    ? session.user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const subtext = liveSessions.length > 0
    ? "You have a live session right now!"
    : todaySessions.length > 0
    ? `You have ${todaySessions.length} session${todaySessions.length > 1 ? "s" : ""} today.`
    : "Let's continue your learning journey.";

  const statCards = [
    {
      label: "Enrolled Courses", value: enrolled.length,
      icon: BookOpen, iconBg: "bg-brand-50",   iconColor: "text-brand-600",
      href: "/dashboard/my-courses",
    },
    {
      label: "Lessons Completed", value: stats.completed,
      icon: Trophy, iconBg: "bg-emerald-50", iconColor: "text-emerald-600",
      href: "/dashboard/my-courses",
    },
    {
      label: "Certificates", value: stats.completed,
      icon: Award, iconBg: "bg-amber-50",   iconColor: "text-amber-600",
      href: "/dashboard/certificates",
    },
    {
      label: "Hours Watched", value: "—",
      icon: Clock, iconBg: "bg-violet-50",  iconColor: "text-violet-600",
      href: "/dashboard/achievements",
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Topbar with search and user pill */}
      <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-surface-100 bg-white px-6">
        <div className="flex items-center gap-3">
          <MobileMenuButton />
          <div className="relative max-w-xs flex-1 hidden sm:flex items-center gap-2 bg-surface-50 border border-surface-200 rounded-full px-4 py-2">
            <Search size={14} className="text-gray-400" />
            <span className="text-sm text-gray-400">Search courses, lessons...</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-surface-200 text-gray-400 hover:bg-surface-50">
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500" />
          </button>
          <div className="flex items-center gap-2 rounded-full border border-surface-200 py-1 pl-1 pr-3 cursor-pointer hover:bg-surface-50">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-900 hidden sm:inline">{session.user.name}</span>
            <ChevronDown size={13} className="text-gray-400" />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5 sm:p-7 space-y-6">

          {/* Greeting */}
          <div>
            <h1 className="font-display text-2xl font-extrabold text-gray-900">Hi, {firstName} 👋</h1>
            <p className="mt-1 text-sm text-gray-400">{subtext}</p>
          </div>

          {/* 4 stat cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statCards.map(({ label, value, icon: Icon, iconBg, iconColor, href }) => (
              <div key={label} className="rounded-2xl border border-surface-100 bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400">{label}</span>
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", iconBg)}>
                    <Icon size={17} className={iconColor} />
                  </div>
                </div>
                <p className="font-display text-3xl font-extrabold text-gray-900">{value}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-400">This month</span>
                  <Link href={href} className="text-xs font-medium text-brand-600 hover:underline">View more →</Link>
                </div>
              </div>
            ))}
          </div>

          {/* Middle: 2 columns */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_460px]">

            {/* LEFT: Courses panel */}
            <div className="rounded-2xl border border-surface-100 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-sm font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen size={15} className="text-brand-500" /> Courses
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Recents</span>
                  <Link href="/dashboard/my-courses" className="text-xs font-medium text-brand-600 hover:underline">
                    View all
                  </Link>
                </div>
              </div>

              {enrolled.length === 0 ? (
                <div className="py-10 text-center">
                  <BookOpen size={24} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-xs text-gray-400 mb-3">No courses yet</p>
                  <Link href="/courses" className="text-xs font-medium text-brand-600 hover:underline">
                    Browse courses →
                  </Link>
                </div>
              ) : (
                <div>
                  {enrolled.slice(0, 4).map((e) => {
                    const progress = Number(e.progress);
                    return (
                      <div key={e.enrollmentId} className="flex items-center gap-3 py-3 border-b border-surface-50 last:border-none">
                        <div className={cn(
                          "h-11 w-11 flex-shrink-0 rounded-xl bg-gradient-to-br overflow-hidden flex items-center justify-center",
                          GRADIENTS[hashStr(e.courseId) % GRADIENTS.length]
                        )}>
                          {e.courseThumbnail
                            ? <Image src={e.courseThumbnail} alt="" width={44} height={44} className="object-cover" />
                            : <BookOpen size={18} className="text-white/40" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{e.courseTitle}</p>
                          <p className="text-[10px] text-gray-400 mb-1.5">
                            {e.categoryName} · {e.courseFormat ?? "Online"}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-surface-100 overflow-hidden">
                              <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="text-[10px] text-gray-400 w-6 text-right">
                              {progress > 0 ? `${progress}%` : "New"}
                            </span>
                          </div>
                        </div>
                        <Link href={`/learn/${e.courseId}`}
                          className="flex-shrink-0 text-[11px] font-semibold text-brand-600 border border-brand-200 rounded-lg px-3 py-1.5 hover:bg-brand-50 transition-colors">
                          {progress > 0 ? "Continue" : "Start"}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT: Calendar — day strip + selected day's sessions */}
            <CalendarWidget allSessions={allSessions} now={now} />
          </div>
        </div>
      </div>
    </div>
  );
}
