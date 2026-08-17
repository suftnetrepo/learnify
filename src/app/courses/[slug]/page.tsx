import { db } from "@/db";
import { enrollments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CheckoutButton } from "@/app/checkout/[courseId]/CheckoutButton";
import {
  BookOpen, Clock, BarChart, Globe, Users, Star,
  CheckCircle2, Lock, PlayCircle, Award, MapPin,
  Video, Shield, Zap, ChevronRight,
} from "lucide-react";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { PreviewModal } from "./PreviewModal";
import { CourseDetailTabs } from "./CourseDetailTabs";
import { CourseService } from "@/services";
import Link from "next/link";
import Image from "next/image";

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await CourseService.getDetailBySlug(slug);
  if (!result) return { title: "Course not found" };
  const { course } = result;
  return {
    title:       `${course.title} | Learnify`,
    description: course.shortDescription ?? undefined,
    openGraph: {
      title:       course.title,
      description: course.shortDescription ?? undefined,
      images:      course.thumbnailUrl ? [{ url: course.thumbnailUrl }] : [],
    },
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const session  = await auth();

  const result = await CourseService.getDetailBySlug(slug);
  if (!result) notFound();
  const { course, sectionsWithLectures, assignment, reviews } = result;

  let isEnrolled = false;
  let enrollmentId = "";
  if (session?.user?.role === "student") {
    const [enrol] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(eq(enrollments.studentId, session.user.id), eq(enrollments.courseId, course.id)))
      .limit(1);
    isEnrolled   = !!enrol;
    enrollmentId = enrol?.id ?? "";
  }

  const safeParse = (raw: string | null | undefined): string[] => {
    if (!raw) return [];
    try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; }
    catch { return []; }
  };
  const whatYouLearn = safeParse(course.whatYouLearn);
  const requirements = safeParse(course.requirements);
  const rating       = Number(course.averageRating ?? 0);
  const totalHours   = course.totalDuration ? Math.round(course.totalDuration / 3600) : null;

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-0">
      <Navbar session={session} />

      {/* ── HERO BANNER ─────────────────────────────────────────────────── */}
      <div className="bg-[#1c1d1f] text-white">
        <div className="container py-10 lg:py-12">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4 lg:pr-8">
              <nav className="flex items-center gap-1.5 text-xs text-gray-400">
                <Link href="/courses" className="hover:text-white transition-colors">Courses</Link>
                {course.categoryName && (
                  <>
                    <ChevronRight size={12} />
                    <Link href={`/courses?category=${course.categorySlug}`} className="hover:text-white transition-colors">
                      {course.categoryName}
                    </Link>
                  </>
                )}
              </nav>

              <h1 className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl">
                {course.title}
              </h1>

              {course.shortDescription && (
                <p className="text-base text-gray-300 leading-relaxed max-w-2xl">{course.shortDescription}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm pt-1">
                {rating > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-amber-400">{rating.toFixed(1)}</span>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} className={i < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-600"} />
                      ))}
                    </div>
                    {course.reviewCount ? <span className="text-gray-400">({course.reviewCount.toLocaleString()} ratings)</span> : null}
                  </div>
                )}
                <span className="flex items-center gap-1.5 text-gray-300">
                  <Users size={13} className="text-gray-400" />
                  {(course.enrollmentCount ?? 0).toLocaleString()} students
                </span>
              </div>

              {assignment?.tutorName && (
                <p className="text-sm text-gray-400">
                  Instructor: <span className="font-medium text-brand-400 underline cursor-pointer">{assignment.tutorName}</span>
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {course.level && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-200">
                    <BarChart size={12} /> <span className="capitalize">{course.level} level</span>
                  </span>
                )}
                {course.language && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-200">
                    <Globe size={12} /> {course.language}
                  </span>
                )}
                {totalHours && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-200">
                    <Clock size={12} /> {totalHours}h total
                  </span>
                )}
                {course.format === "in_person" && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-200">
                    <MapPin size={12} /> In-person
                  </span>
                )}
                {course.format === "online" && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-200">
                    <Video size={12} /> Online
                  </span>
                )}
              </div>
            </div>
            <div className="hidden lg:block" />
          </div>
        </div>
      </div>

      {/* ── STATS BAR ───────────────────────────────────────────────────── */}
      <div className="border-b border-surface-100 bg-surface-50">
        <div className="container">
          <div className="flex flex-wrap gap-8 py-5">
            {[
              { icon: BookOpen, label: `${course.totalLectures ?? "—"} lectures` },
              { icon: Clock,    label: totalHours ? `${totalHours} hours of video` : "Self-paced" },
              { icon: Award,    label: "Certificate of completion" },
              { icon: Shield,   label: "30-day money-back guarantee" },
              { icon: Globe,    label: "Access on any device" },
              { icon: Zap,      label: "Instant access" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-gray-600">
                <Icon size={15} className="text-brand-500 flex-shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <div className="container py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
          <div className="space-y-10 min-w-0">
            {whatYouLearn.length > 0 && (
              <section>
                <h2 className="font-display text-xl font-bold text-gray-900 mb-4">What you&apos;ll learn</h2>
                <div className="rounded-2xl border border-surface-200 p-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {whatYouLearn.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0 text-brand-500" />
                        <span className="text-sm text-gray-700 leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <CourseDetailTabs
              course={course}
              sectionsWithLectures={sectionsWithLectures}
              requirements={requirements}
              assignment={assignment}
              reviews={reviews}
              rating={rating}
            />
          </div>

          {/* Sticky purchase card */}
          <div>
            <div className="sticky top-24 rounded-2xl border border-surface-200 shadow-lg overflow-hidden">
              {course.thumbnailUrl ? (
                <div className="relative aspect-video">
                  <Image src={course.thumbnailUrl} alt={course.title} fill sizes="340px" className="object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
                      <PlayCircle size={28} className="text-brand-600 ml-0.5" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-brand-50 flex items-center justify-center">
                  <BookOpen size={40} className="text-brand-200" />
                </div>
              )}

              <div className="p-5 space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold text-gray-900">
                    {Number(course.price) === 0 ? "Free" : formatCurrency(Number(course.price))}
                  </span>
                  {Number(course.price) > 0 && <span className="text-xs text-gray-400">one-time payment</span>}
                </div>

                {isEnrolled ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 py-2.5 text-sm font-medium text-emerald-700">
                      <CheckCircle2 size={15} className="text-emerald-600" /> You&apos;re enrolled
                    </div>
                    <Link href={`/dashboard/courses/${course.id}`}
                      className="flex h-11 w-full items-center justify-center rounded-xl border border-surface-200 bg-white text-sm font-semibold text-gray-700 hover:bg-surface-50 transition-colors">
                      Continue learning →
                    </Link>
                  </div>
                ) : !session ? (
                  <div className="space-y-2">
                    <Link href={`/login?callbackUrl=/courses/${slug}`}
                      className="flex h-12 w-full items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white hover:bg-brand-600 transition-colors">
                      Enrol now
                    </Link>
                    <p className="text-center text-xs text-gray-400">Sign in or create a free account to enrol</p>
                  </div>
                ) : session.user.role !== "student" ? (
                  <p className="text-center text-xs text-gray-400 py-2">Only students can purchase courses.</p>
                ) : (
                  <CheckoutButton courseId={course.id} price={Number(course.price)} isFree={Number(course.price) === 0} />
                )}

                <div className="border-t border-surface-100 pt-4 space-y-2">
                  {[
                    { icon: Shield, text: "30-day money-back guarantee" },
                    { icon: Zap,    text: "Instant access after payment" },
                    { icon: Globe,  text: "Learn on any device, anytime" },
                    { icon: Award,  text: "Certificate of completion" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-2.5 text-xs text-gray-500">
                      <Icon size={13} className="flex-shrink-0 text-brand-500" />
                      {text}
                    </div>
                  ))}
                </div>

                <div className="border-t border-surface-100 pt-3 flex items-center justify-center gap-4 text-xs text-gray-400">
                  <button className="hover:text-gray-600 transition-colors">Share</button>
                  <span>·</span>
                  <button className="hover:text-gray-600 transition-colors">Gift this course</button>
                </div>
              </div>
            </div>

            {assignment?.tutorName && (
              <div className="mt-4 rounded-2xl border border-surface-200 p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Instructor</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white">
                    {assignment.tutorName[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{assignment.tutorName}</p>
                    {assignment.tutorBio && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{assignment.tutorBio}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE STICKY BUY BAR ─────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-surface-100 bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl font-extrabold text-gray-900">
              {Number(course.price) === 0 ? "Free" : formatCurrency(Number(course.price))}
            </p>
            <p className="text-xs text-gray-400">
              {Number(course.price) > 0 ? "One-time payment" : "No payment required"}
            </p>
          </div>
          {isEnrolled ? (
            <Link href={`/dashboard/courses/${course.id}`}
              className="flex h-11 items-center rounded-xl bg-brand-500 px-6 text-sm font-bold text-white">
              Continue →
            </Link>
          ) : !session ? (
            <Link href={`/login?callbackUrl=/courses/${slug}`}
              className="flex h-11 items-center rounded-xl bg-brand-500 px-6 text-sm font-bold text-white">
              Enrol now
            </Link>
          ) : session.user.role === "student" ? (
            <CheckoutButton courseId={course.id} price={Number(course.price)} isFree={Number(course.price) === 0} />
          ) : null}
        </div>
      </div>

      <Footer />
    </div>
  );
}
