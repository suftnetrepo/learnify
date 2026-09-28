import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CourseViewer } from "./CourseViewer";
import { ReviewForm } from "@/app/(dashboard)/dashboard/courses/[id]/ReviewForm";
import { EnrollmentService } from "@/services/enrollment.service";
import { CourseService } from "@/services/course.service";
import { courseHasAiTutor, loadStudyMindCourseData } from "@/lib/studymind";
import { StudentStudyMindDrawer } from "@/components/studymind/StudentStudyMindDrawer";
import { UnifiedMessagingDrawer } from "@/components/messaging/UnifiedMessagingDrawer";
import { CourseMessagingService } from "@/services";

/** Right offset shared by the floating AI Tutor / Messages buttons (see CourseViewer's layout). */
const FLOATING_RIGHT = "right-4 lg:right-[384px] xl:right-[424px] 2xl:right-[464px]";

interface Props {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ lecture?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const title = await CourseService.getTitle(id).catch(() => null);
  return { title: title ?? "Course" };   // the root layout adds " | Learnify"
}

export default async function LearnPage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: courseId }         = await params;
  const { lecture: lectureParam } = await searchParams;

  const data = await EnrollmentService.getCourseViewerData(session.user.id, courseId);
  if (!data) redirect(`/checkout/${courseId}`);

  const { enrollment, course, sectionsWithLectures, progressMap, hasReviewed, totalLectures } = data;
  const [studyMindCourse, liveSession] = await Promise.all([
    // AI tutor is optional — the course player works without StudyMind configured —
    // and a paid-course feature: free courses (price 0) don't get it
    process.env.STUDYMIND_API_KEY
      ? courseHasAiTutor(courseId).then((paid) => (paid ? loadStudyMindCourseData(courseId) : null))
      : Promise.resolve(null),
    // Live Q&A opens while one of the course's sessions is running (the drawer re-checks while open)
    CourseMessagingService.activeSession(courseId, session.user.id),
  ]);
  const allLectures   = sectionsWithLectures.flatMap((s) => s.lectures);
  const activeLecture = lectureParam
    ? allLectures.find((l) => l.id === lectureParam) ?? allLectures[0] ?? null
    : allLectures[0] ?? null;
  const activeProgress = activeLecture ? (progressMap[activeLecture.id] ?? null) : null;

  return (
    <>
      <CourseViewer
        course={course}
        enrollment={enrollment}
        sections={sectionsWithLectures}
        activeLecture={activeLecture}
        activeProgress={activeProgress}
        progressMap={progressMap}
        totalLectures={totalLectures}
        studentName={session.user.name}
      />
      {studyMindCourse && (
        <StudentStudyMindDrawer
          courseId={courseId}
          courseData={studyMindCourse}
          // Desktop: just left of CourseViewer's curriculum column (lg:360 xl:400 2xl:440) so it never
          // covers the lecture list; phones/tablets (stacked layout): bottom-right of the screen
          buttonPositionClassName={`bottom-6 ${FLOATING_RIGHT}`}
        />
      )}
      <UnifiedMessagingDrawer
        courseId={courseId}
        courseName={course.title}
        currentUserId={session.user.id}
        currentRole={session.user.role}
        liveSession={liveSession && {
          id:            liveSession.id,
          title:         liveSession.title,
          startDatetime: liveSession.startDatetime.toISOString(),
          endDatetime:   liveSession.endDatetime.toISOString(),
        }}
        // Stacked just above the AI Tutor button (same offset)
        buttonPositionClassName={`${studyMindCourse ? "bottom-20" : "bottom-6"} ${FLOATING_RIGHT}`}
      />
      {!hasReviewed && enrollment.completedAt && (
        <ReviewForm courseId={courseId} existingReview={undefined} progress={Number(enrollment.progress)} />
      )}
    </>
  );
}
