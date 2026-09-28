import { CourseMessagingService, CourseService } from "@/services";
import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { CourseForm } from "@/components/shared/CourseForm";
import { TutorAssignmentSection } from "./TutorAssignmentSection";
import { CourseStatusBadge } from "@/components/ui/Badge";
import { SessionsManager } from "@/components/sessions/SessionsManager";
import { SectionsManager } from "./sections/SectionsManager";
import { CourseEditTabs } from "./CourseEditTabs";
import { StudyMindDrawer } from "@/components/studymind/StudyMindDrawer";
import { loadStudyMindCourseData } from "@/lib/studymind";
import { UnifiedMessagingDrawer } from "@/components/messaging/UnifiedMessagingDrawer";

export const metadata: Metadata = { title: "Edit Course" };

interface Props { params: Promise<{ id: string }> }

export default async function EditCoursePage({ params }: Props) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) redirect("/login");

  const [result, sectionsWithLectures, liveSession] = await Promise.all([
    CourseService.getAdminCourseEditData(id),
    CourseService.getSectionsWithLectures(id),
    CourseMessagingService.activeSession(id),
  ]);
  if (!result) notFound();
  const { course, categories: allCategories, sessions } = result;

  // Same outline the course player sends, so StudyMind indexes it once (see loadStudyMindCourseData)
  const studyMindCourse = process.env.STUDYMIND_API_KEY
    ? await loadStudyMindCourseData(id)
    : null;

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-surface-100 bg-white px-6 py-4">
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
            <Link href="/admin/courses" className="hover:text-gray-700">Courses</Link>
            <span>/</span>
            <span className="text-gray-700 font-medium truncate">{course.title}</span>
          </nav>
          <h1 className="font-display text-xl font-bold text-gray-900 truncate">{course.title}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <CourseStatusBadge status={course.status} />
            <span className="text-xs text-gray-400 capitalize">{course.format?.replace("_", "-")}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <CourseEditTabs
        overview={
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
              handoutUrl:       course.handoutUrl ?? undefined,
              handoutName:      course.handoutName ?? undefined,
            }}
          />
        }
        curriculum={
          <SectionsManager
            courseId={course.id}
            format={course.format}
            initialSections={sectionsWithLectures}
          />
        }
        tutors={
          <TutorAssignmentSection courseId={course.id} />
        }
        sessions={
          <SessionsManager
            courseId={course.id}
            format={course.format}
            sessions={sessions}
          />
        }
      />

      {studyMindCourse && <StudyMindDrawer courseId={course.id} courseData={studyMindCourse} />}

      {/* Admin: post notices, message the course's tutors (Staff); Live Q&A and Private are read-only */}
      <UnifiedMessagingDrawer
        courseId={course.id}
        courseName={course.title}
        currentUserId={session.user.id}
        currentRole="admin"
        liveSession={liveSession && {
          id:            liveSession.id,
          title:         liveSession.title,
          startDatetime: liveSession.startDatetime.toISOString(),
          endDatetime:   liveSession.endDatetime.toISOString(),
        }}
      />
    </div>
  );
}
