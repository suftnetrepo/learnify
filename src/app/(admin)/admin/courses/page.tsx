import { Metadata } from "next";
import { CourseService } from "@/services";
import { Topbar } from "@/components/layout/Topbar";
import { CourseStatusBadge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";
import { CourseFilters } from "./CourseFilters";

export const metadata: Metadata = { title: "Manage Courses" };

interface PageProps {
  searchParams: Promise<{
    page?:   string;
    search?: string;
    status?: string;
    format?: string;
    sort?:   string;
  }>;
}

const PER_PAGE = 15;

export default async function AdminCoursesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page   = Math.max(1, Number(params.page ?? 1));
  const search = params.search ?? "";
  const status = params.status ?? "";
  const format = params.format ?? "";

  // Build where clause
  const sort   = (params.sort ?? "newest");
  const { courses: rows, total, totalPages } = await CourseService.listAdmin({
    search: search || undefined,
    status: status || undefined,
    page,
    limit: PER_PAGE,
    sort,
  });

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Courses" }]} />

      <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading-1 text-gray-900">Courses</h1>
            <p className="mt-1 text-sm text-gray-500">{total} courses total</p>
          </div>
          <Link href="/admin/courses/new">
            <Button leftIcon={<Plus size={16} />}>New Course</Button>
          </Link>
        </div>

        {/* Filters */}
        <CourseFilters search={search} status={status} format={format} />

        {/* Table */}
        {rows.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={32} />}
            title="No courses found"
            description={search ? "Try adjusting your search or filters." : "Create your first course to get started."}
            action={
              <Link href="/admin/courses/new">
                <Button leftIcon={<Plus size={16} />}>New Course</Button>
              </Link>
            }
          />
        ) : (
          <div className="table-container">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="table-header">Title</th>
                  <th className="table-header hidden sm:table-cell">Category</th>
                  <th className="table-header hidden md:table-cell">Format</th>
                  <th className="table-header">Price</th>
                  <th className="table-header">Students</th>
                  <th className="table-header">Status</th>
                  <th className="table-header hidden lg:table-cell">Created</th>
                  <th className="table-header w-20"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((course) => (
                  <tr key={course.id} className="table-row">
                    <td className="table-cell max-w-[200px]">
                      <p className="font-medium text-gray-900 truncate">{course.title}</p>
                      <p className="text-xs text-gray-400">{course.categoryName ?? "—"}</p>
                    </td>
                    <td className="table-cell text-gray-500">{course.categoryName ?? "—"}</td>
                    <td className="table-cell capitalize text-gray-500">
                      {course.format.replace("_", " ")}
                    </td>
                    <td className="table-cell font-medium">{formatCurrency(Number(course.price))}</td>
                    <td className="table-cell">{course.enrollmentCount ?? 0}</td>
                    <td className="table-cell">
                      <CourseStatusBadge status={course.status} />
                    </td>
                    <td className="table-cell text-gray-400">{formatDate(course.createdAt)}</td>
                    <td className="table-cell">
                      <Link href={`/admin/courses/${course.id}`}>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-surface-100 px-4 py-3">
                <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
                <div className="flex gap-2">
                  {page > 1 && (
                    <Link href={`?page=${page - 1}&search=${search}&status=${status}&format=${format}`}>
                      <Button variant="outline" size="sm">Previous</Button>
                    </Link>
                  )}
                  {page < totalPages && (
                    <Link href={`?page=${page + 1}&search=${search}&status=${status}&format=${format}`}>
                      <Button variant="outline" size="sm">Next</Button>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
