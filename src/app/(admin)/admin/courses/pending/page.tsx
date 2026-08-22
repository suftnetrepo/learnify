import { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { db } from "@/db";
import { courses, tutorAssignments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatDate } from "@/lib/utils";
import { ReviewActions } from "./ReviewActions";
import { Clock, User, BookOpen } from "lucide-react";

export const metadata: Metadata = { title: "Pending Review | Admin" };

export default async function PendingReviewPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/login");

  const pending = await db
    .select({
      id:              courses.id,
      title:           courses.title,
      shortDescription: courses.shortDescription,
      format:          courses.format,
      level:           courses.level,
      price:           courses.price,
      pendingReviewAt: courses.pendingReviewAt,
      tutorName:       users.name,
      tutorEmail:      users.email,
    })
    .from(courses)
    .leftJoin(tutorAssignments, eq(tutorAssignments.courseId, courses.id))
    .leftJoin(users,            eq(users.id, tutorAssignments.tutorId))
    .where(eq(courses.status, "pending_review"))
    .orderBy(courses.pendingReviewAt);

  return (
    <div>
      <Topbar breadcrumbs={[
        { label: "Admin",   href: "/admin" },
        { label: "Courses", href: "/admin/courses" },
        { label: "Pending Review" },
      ]} />

      <div className="p-4 sm:p-6 max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-gray-900">Pending Review</h1>
          <p className="mt-1 text-sm text-gray-400">
            {pending.length} course{pending.length !== 1 ? "s" : ""} waiting for approval.
          </p>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-surface-200 p-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 mx-auto mb-4">
              <BookOpen size={28} className="text-emerald-500" />
            </div>
            <h3 className="font-display text-xl font-bold text-gray-900 mb-2">All caught up</h3>
            <p className="text-sm text-gray-400">No courses are waiting for review right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((c) => (
              <div key={c.id} className="rounded-2xl border border-amber-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        Pending review
                      </span>
                      <span className="text-xs text-gray-400 capitalize">
                        {c.format?.replace("_", "-")} · {c.level}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-gray-900">{c.title}</h3>
                    {c.shortDescription && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{c.shortDescription}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-display text-xl font-bold text-gray-900">
                      £{Number(c.price ?? 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400">Price</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  <span className="flex items-center gap-1.5">
                    <User size={12} />
                    {c.tutorName ?? "Unknown"} ({c.tutorEmail})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} />
                    Submitted {c.pendingReviewAt
                      ? formatDate(c.pendingReviewAt)
                      : "recently"
                    }
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/courses/${c.id}`}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    Review full course →
                  </Link>
                  <div className="ml-auto">
                    <ReviewActions courseId={c.id} courseTitle={c.title ?? ""} />
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
