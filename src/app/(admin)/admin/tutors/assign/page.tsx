import { Metadata } from "next";
import { UserService, CourseService } from "@/services";
import { Topbar } from "@/components/layout/Topbar";
import { AssignTutorForm } from "./AssignTutorForm";

export const metadata: Metadata = { title: "Assign Tutor" };

interface Props { searchParams: Promise<{ courseId?: string }> }

export default async function AssignTutorPage({ searchParams }: Props) {
  const { courseId } = await searchParams;

  const [tutors, courses] = await Promise.all([
    UserService.getActiveTutors(),
    CourseService.getPublishedForSelect(),
  ]);

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Tutors", href: "/admin/tutors" }, { label: "Assign Tutor" }]} />
      <div className="p-6 max-w-2xl">
        <div className="mb-8">
          <h1 className="heading-1 text-gray-900">Assign a Tutor</h1>
          <p className="mt-1 text-sm text-gray-500">Select a tutor and course, then set the assignment period.</p>
        </div>
        <AssignTutorForm tutors={tutors} courses={courses} preselectedCourseId={courseId ?? ""} />
      </div>
    </div>
  );
}
