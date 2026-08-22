import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireCourseAccess } from "@/lib/access/course";
import { CourseService } from "@/services/course.service";
import { TutorService } from "@/services/tutor.service";
import { isTutorManagerEnabled } from "@/lib/flags";
import { CourseEditTabs } from "@/app/(admin)/admin/courses/[id]/CourseEditTabs";
import { SectionsManager } from "@/app/(admin)/admin/courses/[id]/sections/SectionsManager";
import { SubmitForApprovalButton } from "./SubmitForApprovalButton";
import { CourseForm } from "@/components/shared/CourseForm";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function InstructorCourseEditPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: courseId } = await params;

  // Guard — must be editor or admin
  const allowed = await requireCourseAccess(
    session.user.id,
    courseId,
    session.user.role,
    "editor"
  );
  if (!allowed) redirect("/instructor/courses");

  const [course, sectionsWithLectures, assignment, categories] = await Promise.all([
    CourseService.findById(courseId),
    CourseService.getSectionsWithLectures(courseId),
    session.user.role === "tutor"
      ? TutorService.getActiveAssignment(session.user.id, courseId)
      : Promise.resolve(null),
    CourseService.getCategories(),
  ]);
  if (!course) notFound();

  // Only a manager-level tutor (or an admin) can actually submit for review —
  // showing the button to an editor-only tutor would just 403 when clicked.
  const canSubmitForReview =
    course.status === "draft" &&
    isTutorManagerEnabled() &&
    (session.user.role === "admin" || assignment?.accessLevel === "manager");

  // A manager-level tutor can edit their own course's content and price —
  // publishing still goes through the submit-for-review → admin approval flow.
  const isManager = assignment?.accessLevel === "manager";

  const accessBadgeLabel =
    session.user.role === "admin" ? "Admin view"
    : isManager ? "Manager access"
    : "Editor access";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-100 bg-white px-6 py-4 flex-shrink-0">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
            <Link href="/instructor/courses" className="hover:text-gray-700">
              My Courses
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-medium">{course.title}</span>
          </nav>
          <h1 className="font-display text-xl font-bold text-gray-900">{course.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
              course.status === "published" ? "bg-emerald-100 text-emerald-700" :
              course.status === "archived"  ? "bg-gray-100 text-gray-600" :
              course.status === "pending_review" ? "bg-amber-100 text-amber-700" :
              "bg-surface-100 text-gray-600"
            )}>
              {course.status.replace("_", " ")}
            </span>
            <span className="text-xs text-gray-400 capitalize">
              {course.format?.replace("_", "-")}
            </span>
            {/* Access badge so tutor/admin knows their access level here */}
            <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
              {accessBadgeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Rejection note banner */}
      {course.rejectionNote && course.status === "draft" && (
        <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">
            Changes requested
          </p>
          <p className="text-sm text-red-700">{course.rejectionNote}</p>
          <p className="text-xs text-red-400 mt-1">
            Address the feedback above then resubmit for approval.
          </p>
        </div>
      )}

      {/* Pending review banner */}
      {course.status === "pending_review" && (
        <div className="mx-6 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">Pending admin review</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Submitted {course.pendingReviewAt
                ? new Date(course.pendingReviewAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })
                : "recently"
              }. You will be notified by email once reviewed.
            </p>
          </div>
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
        </div>
      )}

      {/* Submit for approval button */}
      {canSubmitForReview && (
        <SubmitForApprovalButton courseId={courseId} />
      )}

      {/* Reuse admin tabs — but only show Overview + Curriculum tabs for tutors */}
      <CourseEditTabs
        role="tutor"
        overview={
          isManager ? (
            // Manager can edit title, description, price — not publish
            <CourseForm
              categories={categories}
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
              hidePublish
              hideStatus
            />
          ) : (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
              Course title, pricing, and publishing are managed by the platform admin.
              You can edit sections and lectures in the Curriculum tab.
            </div>
          )
        }
        curriculum={
          <SectionsManager
            courseId={course.id}
            format={course.format}
            initialSections={sectionsWithLectures}
          />
        }
        tutors={null}
        sessions={null}
      />
    </div>
  );
}
