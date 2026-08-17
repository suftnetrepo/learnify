import { Metadata } from "next";
import { CourseService } from "@/services";
import { Topbar } from "@/components/layout/Topbar";
import { CourseForm } from "@/components/shared/CourseForm";

export const metadata: Metadata = { title: "New Course" };

export default async function NewCoursePage() {
  const cats = await CourseService.getCategories();

  return (
    <div>
      <Topbar
        breadcrumbs={[
          { label: "Admin",   href: "/admin" },
          { label: "Courses", href: "/admin/courses" },
          { label: "New Course" },
        ]}
      />
      <div className="p-4 sm:p-6 max-w-3xl">
        <div className="mb-6">
          <h1 className="heading-1 text-gray-900">New Course</h1>
          <p className="mt-1 text-sm text-gray-500">
            Fill in the details below. You can add sections and lectures after saving.
          </p>
        </div>
        <CourseForm categories={cats} mode="create" />
      </div>
    </div>
  );
}
