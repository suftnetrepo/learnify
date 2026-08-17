import { redirect } from "next/navigation";

// /dashboard/courses → redirect to main dashboard which shows enrolled courses
export default function DashboardCoursesPage() {
  redirect("/dashboard");
}
