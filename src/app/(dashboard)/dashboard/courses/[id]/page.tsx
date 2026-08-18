import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CourseViewer } from "./CourseViewer";
import { ReviewForm } from "./ReviewForm";
import { EnrollmentService } from "@/services/enrollment.service";

interface Props {
  params:       Promise<{ id: string }>;
  searchParams: Promise<{ lecture?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await EnrollmentService.getCourseViewerData("preview", id).catch(() => null);
  return { title: data?.course?.title ? `${data.course.title} | Learnify` : "Course" };
}

export default async function CoursePage({ params, searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id: courseId }         = await params;
  const { lecture: lectureParam } = await searchParams;

  const data = await EnrollmentService.getCourseViewerData(session.user.id, courseId);
  if (!data) redirect(`/checkout/${courseId}`);

  const { enrollment, course, sectionsWithLectures, progressMap, hasReviewed, totalLectures } = data;

  const allLectures    = sectionsWithLectures.flatMap((s) => s.lectures);
  const activeLecture  = lectureParam
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
      />
      {!hasReviewed && enrollment.completedAt && (
        <ReviewForm
          courseId={courseId}
          existingReview={undefined}
          progress={Number(enrollment.progress)}
        />
      )}
    </>
  );
}
