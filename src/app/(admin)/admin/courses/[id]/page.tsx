import { CourseService } from "@/services";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { CourseForm } from "@/components/shared/CourseForm";
import { TutorAssignmentSection } from "./TutorAssignmentSection";
import { CourseStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LayoutList, Calendar } from "lucide-react";
import { SessionsManager } from "@/components/sessions/SessionsManager";

export const metadata: Metadata = { title: "Edit Course" };

interface Props { params: Promise<{ id: string }> }

export default async function EditCoursePage({ params }: Props) {
  const { id } = await params;

  const result = await CourseService.getAdminCourseEditData(id);
  if (!result) notFound();
  const { course, categories: allCategories, sections, sessions } = result;

  const sessionsWithStats = sessions;

  return (
    <div>
      <Topbar
        breadcrumbs={[
          { label: "Admin",   href: "/admin" },
          { label: "Courses", href: "/admin/courses" },
          { label: course.title },
        ]}
      />
      <div className="p-6 max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-1 text-gray-900">{course.title}</h1>
            <div className="mt-2">
              <CourseStatusBadge status={course.status} />
            </div>
          </div>
          <Link href={`/admin/courses/${course.id}/sections`}>
            <Button variant="secondary" leftIcon={<LayoutList size={16} />}>
              Manage Content
            </Button>
          </Link>
        </div>

        <CourseForm
          categories={allCategories}
          mode="edit"
          initialData={{
            id:               course.id,
            title:            course.title,
            description:      course.description ?? undefined,
            shortDescription: course.shortDescription ?? undefined,
            price:            Number(course.price),
            format:           course.format,
            location:         course.location ?? undefined,
            status:           course.status,
            categoryId:       course.categoryId ?? undefined,
            level:            course.level ?? undefined,
            language:         course.language ?? undefined,
          }}
        />

        <TutorAssignmentSection courseId={course.id} />

        {/* Sessions — shown for non-self-paced formats */}
        {(course.format === "in_person" || course.format === "hybrid" || course.format === "online") && (
          <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-card">
            <div className="flex items-start gap-3 pb-4 border-b border-surface-100 mb-5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Calendar size={16} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Delivery Sessions</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {course.format === "in_person" ? "In-person sessions with venue details" :
                   course.format === "hybrid"    ? "Mixed in-person and online sessions" :
                   "Online live sessions with conference links"}
                </p>
              </div>
            </div>
            <SessionsManager
              courseId={course.id}
              format={course.format}
              sessions={sessionsWithStats}
            />
          </div>
        )}
      </div>
    </div>
  );
}
