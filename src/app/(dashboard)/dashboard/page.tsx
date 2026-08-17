import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { EnrollmentService } from "@/services/enrollment.service";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/Card";
import { formatCurrency, formatDate, formatDuration } from "@/lib/utils";
import { CourseStatusBadge } from "@/components/ui/Badge";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, GraduationCap, Clock, Trophy, Calendar, MapPin, Video } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Redirect admins and tutors to their own dashboards
  if (session.user.role === "admin")   redirect("/admin");
  // Tutors see their instructor dashboard (their assigned courses)

  const userId = session.user.id;

  const { enrolled: myEnrollments, stats } = await EnrollmentService.getDashboardData(userId);
  const { totalSpent, completed, inProgress: inProgressCount } = stats;

  const inProgress = myEnrollments.filter((e) => Number(e.progress) > 0 && !e.completedAt);
  const completedCourses = myEnrollments.filter((e) => !!e.completedAt);
  const sessionMap: Record<string, unknown> = {};

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Dashboard" }]} />
      <div className="p-4 sm:p-6 space-y-8">
        {/* Greeting */}
        <div>
          <h1 className="heading-1 text-gray-900">
            Welcome back, {session.user.name?.split(" ")[0] ?? "there"} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">Pick up where you left off.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Enrolled"  value={myEnrollments.length}   icon={<BookOpen      size={20} />} />
          <StatCard label="In Progress"     value={inProgress.length}       icon={<Clock         size={20} />} />
          <StatCard label="Completed"       value={completedCourses.length} icon={<Trophy        size={20} />} />
          <StatCard label="Certificates"    value={myEnrollments.filter(e => !!e.completedAt).length} icon={<GraduationCap size={20} />} />
        </div>

        {/* In-progress courses */}
        {inProgress.length > 0 && (
          <section>
            <h2 className="heading-2 text-gray-900 mb-4">Continue Learning</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inProgress.map((e) => (
                <Link
                  key={e.enrollmentId}
                  href={`/dashboard/courses/${e.courseId}`}
                  className="card card-hover p-4 block group"
                >
                  {e.courseThumbnail ? (
                    <div className="relative mb-3 h-36 w-full rounded-xl overflow-hidden">
                      <Image
                        src={e.courseThumbnail}
                        alt={e.courseTitle ?? ""}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                  ) : (
                    <div className="mb-3 h-36 w-full rounded-xl bg-brand-100" />
                  )}
                  <h3 className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                    {e.courseTitle}
                  </h3>
                  <p className="mt-1 text-xs text-gray-400 capitalize">
                    {e.courseFormat} · {0 ? formatDuration(0) : "—"}
                  </p>
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Progress</span>
                      <span className="text-xs font-medium text-brand-600">{e.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-100">
                      <div
                        className="h-1.5 rounded-full bg-brand-500"
                        style={{ width: `${e.progress}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* All enrolled */}
        {myEnrollments.length === 0 && (
          <div className="card p-12 text-center">
            <BookOpen size={40} className="mx-auto mb-4 text-gray-200" />
            <h3 className="heading-3 text-gray-700">No courses yet</h3>
            <p className="mt-2 text-sm text-gray-400">Browse our catalogue and start learning today.</p>
            <Link href="/courses" className="btn-primary mt-6 inline-flex">
              Browse Courses
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
