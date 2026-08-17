import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { formatCurrency } from "@/lib/utils";
import { CheckoutButton } from "./CheckoutButton";
import { Badge } from "@/components/ui/Badge";
import { BookOpen, Clock, BarChart, Globe, Users, CheckCircle2, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SessionPicker } from "@/components/sessions/SessionPicker";
import { CourseService } from "@/services";
import { SessionService } from "@/services/session.service";
import { EnrollmentService } from "@/services/enrollment.service";
import { TutorService } from "@/services/tutor.service";

interface Props { params: Promise<{ courseId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { courseId } = await params;
  const course = await CourseService.findById(courseId);
  if (!course) return { title: "Checkout" };
  return { title: `Enrol in ${course.title} | Learnify` };
}

export default async function CheckoutPage({ params }: Props) {
  const { courseId } = await params;
  const session      = await auth();

  const course = await CourseService.findById(courseId);
  if (!course || course.status !== "published") notFound();

  const [upcomingSessions, isEnrolled, assignments] = await Promise.all([
    SessionService.getUpcomingForCourse(courseId),
    session?.user?.role === "student"
      ? EnrollmentService.isEnrolled(session.user.id, courseId)
      : Promise.resolve(false),
    TutorService.getAssignmentsForCourse(courseId),
  ]);

  const assignment     = assignments[0] ?? null;
  const isSessionCourse = upcomingSessions.length > 0;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="border-b border-surface-100 bg-white px-6 py-4">
        <Link href="/courses" className="text-sm text-brand-600 hover:underline">
          <span className="flex items-center gap-1.5"><ArrowLeft size={14} />Back to courses</span>
        </Link>
      </header>

      <div className="container py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

          {/* Left — course info */}
          <div className="lg:col-span-2 space-y-6">
            {course.thumbnailUrl ? (
              <div className="relative w-full rounded-2xl overflow-hidden aspect-video">
                <Image
                  src={course.thumbnailUrl}
                  alt={course.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <div className="w-full rounded-2xl bg-surface-100 aspect-video flex items-center justify-center">
                <BookOpen size={48} className="text-gray-300" />
              </div>
            )}

            <div>
              {course.categoryName && (
                <Badge variant="brand" className="mb-3">{course.categoryName}</Badge>
              )}
              <h1 className="heading-1 text-gray-900">{course.title}</h1>
              {course.shortDescription && (
                <p className="mt-3 text-lg text-gray-500">{course.shortDescription}</p>
              )}
            </div>

            {/* Meta row */}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {course.level && (
                <span className="flex items-center gap-1.5"><BarChart size={15} /> {course.level}</span>
              )}
              {course.totalDuration && (
                <span className="flex items-center gap-1.5"><Clock size={15} /> {Math.round(course.totalDuration / 60)}h</span>
              )}
              {course.totalLectures && (
                <span className="flex items-center gap-1.5"><BookOpen size={15} /> {course.totalLectures} lectures</span>
              )}
              {course.language && (
                <span className="flex items-center gap-1.5"><Globe size={15} /> {course.language}</span>
              )}
              <span className="flex items-center gap-1.5">
                <Users size={15} /> {course.enrollmentCount ?? 0} students
              </span>
            </div>

            {/* Description */}
            {course.description && (
              <div>
                <h2 className="heading-2 text-gray-900 mb-3">About this course</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{course.description}</p>
              </div>
            )}

            {/* Instructor */}
            {assignment?.tutorName && (
              <div>
                <h2 className="heading-2 text-gray-900 mb-3">Your instructor</h2>
                <div className="flex items-start gap-4 card p-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-white font-bold text-lg">
                    {assignment.tutorName[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{assignment.tutorName}</p>
                    {assignment.notes && (
                      <p className="mt-1 text-sm text-gray-500">{assignment.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right — sticky purchase card */}
          <div className="lg:col-span-1">
            <div className="card p-6 space-y-5 lg:sticky lg:top-6">
              <div>
                <p className="heading-1 text-gray-900">
                  {Number(course.price) === 0 ? "Free" : formatCurrency(Number(course.price))}
                </p>
                {course.format === "in_person" && (
                  <p className="mt-1 text-xs text-gray-400">In-person course</p>
                )}
              </div>

              {/* Session picker */}
              {isSessionCourse && !isEnrolled && session?.user?.role === "student" && (
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-2">Choose a session</p>
                  <SessionPicker
                    sessions={upcomingSessions.map((s) => ({
                      ...s,
                      startDatetime: s.startDatetime.toISOString(),
                      endDatetime:   s.endDatetime.toISOString(),
                    }))}
                    selectedSessionId={null}
                    onSelect={() => {}}
                  />
                </div>
              )}

              {isEnrolled ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm font-medium text-emerald-700 text-center">
                    <span className="flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" /> Already enrolled
                    </span>
                  </div>
                  <Link href={`/dashboard/courses/${courseId}`}>
                    <Button className="w-full" variant="secondary">Go to course</Button>
                  </Link>
                </div>
              ) : !session ? (
                <div className="space-y-3">
                  <Link href={`/login?callbackUrl=/checkout/${courseId}`}>
                    <Button className="w-full" size="lg">Sign in to enrol</Button>
                  </Link>
                  <Link href={`/register?callbackUrl=/checkout/${courseId}`}>
                    <Button className="w-full" variant="secondary">Create account</Button>
                  </Link>
                </div>
              ) : session.user.role !== "student" ? (
                <p className="text-sm text-gray-400 text-center">Only students can purchase courses.</p>
              ) : (
                <CheckoutButton
                  courseId={courseId}
                  price={Number(course.price)}
                  isFree={Number(course.price) === 0}
                />
              )}

              {/* Guarantees */}
              <div className="border-t border-surface-100 pt-4 space-y-2 text-xs text-gray-400">
                <p className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />Instant access after payment
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />Secure checkout via Stripe
                </p>
                <p className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />30-day money-back guarantee
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
