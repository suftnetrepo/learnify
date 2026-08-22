import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { TutorService } from "@/services/tutor.service";
import { SessionService } from "@/services/session.service";
import { formatDate } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Users, Calendar, Star, BarChart3, LayoutDashboard, Pencil, TrendingUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { gradientFor } from "../_lib/thumbGradient";
import { requireCourseCreate } from "@/lib/access/course";

export const metadata: Metadata = { title: "My Courses | Instructor" };

export default async function InstructorCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tutorId = session.user.id;

  const [assigned, allSessions, canCreate] = await Promise.all([
    TutorService.getInstructorCoursesData(tutorId),
    SessionService.getInstructorSessions(tutorId),
    requireCourseCreate(tutorId, session.user.role),
  ]);

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Instructor" }, { label: "My Courses" }]} />

      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-gray-900">My Courses</h1>
            <p className="mt-1 text-sm text-gray-400">Courses you&apos;ve been assigned to deliver.</p>
          </div>

          {canCreate && (
            <Link
              href="/instructor/courses/new"
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
            >
              <Plus size={15} /> New Course
            </Link>
          )}
        </div>

        {assigned.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-surface-200 p-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 mx-auto mb-4">
              <BookOpen size={28} className="text-brand-500" />
            </div>
            <h3 className="font-display text-xl font-bold text-gray-900 mb-2">No courses assigned yet</h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              Your platform admin will assign courses to you. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assigned.map((a) => {
              const gradient = gradientFor(a.courseId);

              return (
                <div key={a.assignmentId}
                  className="rounded-2xl border border-surface-100 bg-white overflow-hidden hover:border-brand-200 hover:shadow-sm transition-all">

                  {/* Thumbnail */}
                  <div className={cn(
                    "relative h-[130px] w-full bg-gradient-to-br overflow-hidden",
                    gradient
                  )}>
                    {a.courseThumbnail ? (
                      <Image src={a.courseThumbnail} alt={a.courseTitle ?? ""} fill
                        sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <BookOpen size={28} className="text-white/30" />
                      </div>
                    )}
                    {/* Status badge */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-emerald-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-1 capitalize">
                        {a.courseFormat?.replace("_", " ") ?? "Online"}
                      </p>
                      <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 text-sm">
                        {a.courseTitle}
                      </h3>
                    </div>

                    {/* Scrollable stats chips */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {[
                        {
                          icon: <Users size={13} className="text-gray-400" />,
                          value: a.enrollmentCount ?? 0,
                          label: "Students",
                        },
                        {
                          icon: <Calendar size={13} className="text-gray-400" />,
                          value: allSessions.filter((s) => s.courseId === a.courseId).length,
                          label: "Sessions",
                        },
                        {
                          icon: <TrendingUp size={13} className="text-gray-400" />,
                          value: "—",
                          label: "Progress",
                        },
                        {
                          icon: <Star size={13} className="text-gray-400" />,
                          value: "—",
                          label: "Rating",
                        },
                      ].map(({ icon, value, label }) => (
                        <div
                          key={label}
                          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5"
                        >
                          {icon}
                          <span className="text-xs font-semibold text-gray-900">{value}</span>
                          <span className="text-[10px] text-gray-400">{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Assignment dates */}
                    <div className="rounded-lg bg-surface-50 border border-surface-100 px-3 py-2 text-xs text-gray-400">
                      <Calendar size={11} className="inline mr-1.5 -mt-0.5" />
                      Assignment: {formatDate(a.startDate)} → {formatDate(a.endDate)}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Link
                        href="/instructor/sessions"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2.5 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
                      >
                        <LayoutDashboard size={13} /> Sessions
                      </Link>

                      {(a.accessLevel === "editor" || a.accessLevel === "manager") && (
                        <Link
                          href={`/instructor/courses/${a.courseId}`}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
                        >
                          <Pencil size={13} /> Manage
                        </Link>
                      )}

                      <button
                        title="Students"
                        aria-label="Students"
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-surface-200 text-gray-400 hover:bg-surface-50 hover:text-gray-700 transition-colors"
                      >
                        <Users size={15} />
                      </button>

                      <button
                        title="Analytics"
                        aria-label="Analytics"
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-surface-200 text-gray-400 hover:bg-surface-50 hover:text-gray-700 transition-colors"
                      >
                        <BarChart3 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
