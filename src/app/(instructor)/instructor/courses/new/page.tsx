import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireCourseCreate } from "@/lib/access/course";
import { CourseService } from "@/services/course.service";
import { Topbar } from "@/components/layout/Topbar";
import { NewCourseForm } from "./NewCourseForm";

export const metadata: Metadata = { title: "New Course | Instructor" };

export default async function InstructorNewCoursePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canCreate = await requireCourseCreate(session.user.id, session.user.role);
  if (!canCreate) redirect("/instructor/courses");

  const categories = await CourseService.getCategories();

  return (
    <div>
      <Topbar breadcrumbs={[
        { label: "Instructor" },
        { label: "My Courses", href: "/instructor/courses" },
        { label: "New Course" },
      ]} />
      <div className="p-4 sm:p-6 max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-gray-900">Create a course</h1>
          <p className="mt-1 text-sm text-gray-400">
            Fill in the details below. Once you&apos;re ready, submit for admin approval to publish.
          </p>
        </div>
        <NewCourseForm categories={categories} />
      </div>
    </div>
  );
}
