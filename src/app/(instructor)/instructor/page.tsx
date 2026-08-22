import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TutorService } from "@/services/tutor.service";
import { SessionService } from "@/services/session.service";
import { AnalyticsService } from "@/services/analytics.service";
import { formatCurrency } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { Search, Bell, TrendingUp, BookOpen, CalendarDays, Video, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { gradientFor } from "./_lib/thumbGradient";

export const metadata: Metadata = { title: "Dashboard | Instructor" };

export default async function InstructorDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tutorId = session.user.id;

  const [assigned, allSessions, earnings] = await Promise.all([
    TutorService.getInstructorCoursesData(tutorId),
    SessionService.getInstructorSessions(tutorId),
    AnalyticsService.getInstructorEarnings(tutorId),
  ]);

  const now       = new Date();
  const todayStr  = now.toDateString();
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const upcomingSessions = allSessions.filter((s) => new Date(s.startDatetime) > now);
  const totalStudents    = assigned.reduce((sum, a) => sum + (a.enrollmentCount ?? 0), 0);

  const todaySessions = allSessions.filter((s) =>
    new Date(s.startDatetime).toDateString() === todayStr
  );

  // Week days Mon–Fri
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });

  const sessionDays = new Set(
    allSessions.map((s) => new Date(s.startDatetime).toDateString())
  );

  const avgCompletion = 0; // placeholder until lecture progress is summed per instructor

  const statCards = [
    { label: "Assigned courses",  value: assigned.length,          sub: "Active assignments" },
    { label: "Total students",    value: totalStudents,            sub: "Across all courses" },
    { label: "Upcoming sessions", value: upcomingSessions.length,  sub: "Next 30 days"       },
    { label: "Avg completion",    value: `${avgCompletion}%`,      sub: "Across students"    },
  ];

  return (
    <div>
      {/* Header — sticky within the shared scroll container (see CourseEditTabs
          for why we don't nest a second overflow-y-auto region in here). */}
      <header className="sticky top-0 z-10 flex h-14 flex-shrink-0 items-center justify-between border-b border-surface-100 bg-white px-6">
        <div>
          <h1 className="font-display text-lg font-bold text-gray-900">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Here&apos;s what&apos;s happening across your courses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex h-8 w-8 items-center justify-center rounded-full border border-surface-200 text-gray-400 hover:bg-surface-50">
            <Search size={15} />
          </button>
          <button className="relative flex h-8 w-8 items-center justify-center rounded-full border border-surface-200 text-gray-400 hover:bg-surface-50">
            <Bell size={15} />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand-500 ring-1 ring-white" />
          </button>
        </div>
      </header>

      <div className="p-5 sm:p-6 space-y-5">

        {/* 4 stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statCards.map(({ label, value, sub }) => (
            <div key={label} className="rounded-2xl border border-surface-100 bg-white p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="font-display text-2xl font-extrabold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Earnings strip */}
        <div className="flex items-center justify-between rounded-2xl border border-surface-100 bg-white px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
              <TrendingUp size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency(earnings.allTimeEarnings)} earned all time
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatCurrency(earnings.monthEarnings)} this month
                {" · "}
                {formatCurrency(earnings.weekEarnings)} this week
              </p>
            </div>
          </div>
          <Link href="/instructor/earnings"
            className="text-xs font-semibold text-brand-600 hover:underline flex-shrink-0">
            View earnings →
          </Link>
        </div>

        {/* Middle — two columns */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">

          {/* LEFT — Your courses */}
          <div className="rounded-2xl border border-surface-100 bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BookOpen size={14} className="text-brand-500" /> Your courses
              </h2>
              <Link href="/instructor/courses"
                className="text-xs font-medium text-brand-600 hover:underline">
                View all
              </Link>
            </div>

            {assigned.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen size={24} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm text-gray-400">No courses assigned yet</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-50">
                {assigned.map((a) => {
                  const accessLabel =
                    a.accessLevel === "manager" ? "Manager" :
                    a.accessLevel === "editor"  ? "Editor"  : "Viewer";
                  const accessColor =
                    a.accessLevel === "manager" ? "bg-emerald-100 text-emerald-700" :
                    a.accessLevel === "editor"  ? "bg-brand-50 text-brand-700"      :
                    "bg-surface-100 text-gray-500";

                  return (
                    <div key={a.assignmentId} className="flex items-center gap-3 py-3">
                      <div className={cn(
                        "h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br flex items-center justify-center overflow-hidden",
                        gradientFor(a.courseId)
                      )}>
                        {a.courseThumbnail ? (
                          <Image src={a.courseThumbnail} alt="" width={36} height={36} className="object-cover" />
                        ) : (
                          <BookOpen size={14} className="text-white/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {a.courseTitle}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 capitalize">
                          {a.courseFormat?.replace("_", "-")} · {a.enrollmentCount ?? 0} student{a.enrollmentCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className={cn(
                        "flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                        accessColor
                      )}>
                        {accessLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT — Calendar + Today's sessions */}
          <div className="flex flex-col gap-4">

            {/* Mini calendar strip */}
            <div className="rounded-2xl border border-surface-100 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CalendarDays size={14} className="text-brand-500" /> Schedule
                </h2>
                <span className="text-[10px] text-gray-400">
                  {now.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {weekDays.map((day) => {
                  const isToday    = day.toDateString() === todayStr;
                  const hasSession = sessionDays.has(day.toDateString());
                  return (
                    <div key={day.toISOString()} className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl py-2 cursor-pointer transition-colors",
                      isToday ? "bg-brand-500" : "hover:bg-surface-50"
                    )}>
                      <span className={cn(
                        "text-[8px] font-bold uppercase tracking-wide",
                        isToday ? "text-white/70" : "text-gray-400"
                      )}>
                        {day.toLocaleDateString("en-GB", { weekday: "short" })}
                      </span>
                      <span className={cn(
                        "text-sm font-semibold",
                        isToday ? "text-white" : "text-gray-900"
                      )}>
                        {day.getDate()}
                      </span>
                      <div className={cn(
                        "h-1 w-1 rounded-full",
                        hasSession
                          ? isToday ? "bg-white" : "bg-brand-500"
                          : "bg-transparent"
                      )} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Today's sessions */}
            <div className="rounded-2xl border border-surface-100 bg-white p-4 flex-1">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-900">Today&apos;s sessions</h2>
                <Link href="/instructor/sessions"
                  className="text-xs font-medium text-brand-600 hover:underline">
                  View all
                </Link>
              </div>

              {todaySessions.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays size={22} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-xs text-gray-400">No sessions today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todaySessions.map((s) => {
                    const isLive = now >= new Date(s.startDatetime) && now <= new Date(s.endDatetime);
                    const start  = new Date(s.startDatetime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                    const end    = new Date(s.endDatetime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

                    return (
                      <div key={s.id} className={cn(
                        "rounded-xl border p-3",
                        isLive ? "border-red-200 bg-red-50/50" : "border-surface-100"
                      )}>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-brand-500 mb-0.5">
                          {s.courseTitle}
                        </p>
                        <p className="text-xs font-semibold text-gray-900 mb-1.5 line-clamp-1">
                          {s.title ?? "Live Session"}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-2">
                          <span>{start} – {end}</span>
                          {s.conferencePlatform && (
                            <span className="bg-brand-50 text-brand-700 rounded px-1.5 py-0.5 font-semibold">
                              {s.conferencePlatform}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          {isLive ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                              Live now
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">Starts {start}</span>
                          )}
                          {s.conferenceUrl ? (
                            <a href={s.conferenceUrl} target="_blank" rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors",
                                isLive
                                  ? "bg-brand-500 text-white hover:bg-brand-600"
                                  : "bg-surface-100 text-gray-600 hover:bg-surface-200"
                              )}
                            >
                              <Video size={10} />
                              {isLive ? "Join" : "View"}
                            </a>
                          ) : s.venueCity ? (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400">
                              <MapPin size={10} /> {s.venueCity}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
