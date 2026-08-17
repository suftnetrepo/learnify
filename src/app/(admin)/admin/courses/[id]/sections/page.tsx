import { CourseService } from "@/services";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { SectionsManager } from "./SectionsManager";

export const metadata: Metadata = { title: "Manage Content" };

interface Props { params: Promise<{ id: string }> }

export default async function CourseSectionsPage({ params }: Props) {
  const { id: courseId } = await params;

  const [course, sections] = await Promise.all([
    CourseService.findById(courseId),
    CourseService.getSectionsWithLectures(courseId),
  ]);
  if (!course) notFound();

  return (
    <div>
      <Topbar
        breadcrumbs={[
          { label: "Admin",   href: "/admin" },
          { label: "Courses", href: "/admin/courses" },
          { label: course.title, href: `/admin/courses/${courseId}` },
          { label: "Content" },
        ]}
      />
      <div className="p-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="heading-1 text-gray-900">Course Content</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage sections and lectures for <strong>{course.title}</strong>.
          </p>
        </div>
        <SectionsManager courseId={courseId} initialSections={sections} />
      </div>
    </div>
  );
}
