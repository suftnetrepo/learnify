import { TutorService } from "@/services/tutor.service";
import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { CourseStatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BookOpen, Users, CreditCard } from "lucide-react";
import { EmptyState } from "@/components/ui/Card";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "My Courses" };

export default async function InstructorCoursesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tutorId = session.user.id;

  const assigned = await TutorService.getInstructorCoursesData(tutorId);

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Instructor" }, { label: "My Courses" }]} />

      <div className="p-6 space-y-6">
        <div>
          <h1 className="heading-1 text-gray-900">My Courses</h1>
          <p className="mt-1 text-sm text-gray-500">
            Courses you&apos;ve been assigned to deliver.
          </p>
        </div>

        {assigned.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={32} />}
            title="No courses assigned yet"
            description="Your platform admin will assign courses to you. Check back soon."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {assigned.map((a) => (
              <div key={a.assignmentId} className="card card-hover p-0 overflow-hidden">
                {/* Thumbnail */}
                {a.courseThumbnail || "" ? (
                  <div className="relative h-40 w-full overflow-hidden">
                    <Image
                      src={a.courseThumbnail || ""}
                      alt={a.courseTitle ?? ""}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-40 w-full bg-brand-100 flex items-center justify-center">
                    <BookOpen size={32} className="text-white/60" />
                  </div>
                )}

                <div className="p-5 space-y-4">
                  {/* Title + status */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">
                        {a.courseTitle}
                      </h3>
                      {a.status && <CourseStatusBadge status={a.status} />}
                    </div>
                    <p className="mt-1 text-xs text-gray-400 capitalize">
                      {a.courseFormat?.replace("_", " ")}
                    </p>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />
                      {a.enrollmentCount ?? 0} students
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={14} />
                      {formatCurrency(0)}
                    </span>
                  </div>

                  {/* Assignment dates */}
                  <div className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-gray-400">
                    Assignment: {formatDate(a.startDate)} → {formatDate(a.endDate)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
