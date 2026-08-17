import Link from "next/link";
import Image from "next/image";
import { CourseService } from "@/services";
import { CourseCard } from "@/components/course/CourseCard";
import type { CourseListItem } from "@/types/course.types";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { auth } from "@/lib/auth";
import {
  ArrowRight, BookOpen, Users, Star, Shield,
  Zap, Globe, Award, ChevronRight, CheckCircle2,
  Play, TrendingUp, Clock,
} from "lucide-react";

export const revalidate = 3600;


const FEATURES = [
  { icon: Zap,    title: "Practitioner-led",    body: "Every course is built by someone who's done the work — not just studied it." },
  { icon: Award,  title: "Verified certificates", body: "Complete a course and earn a certificate you can share with employers." },
  { icon: Globe,  title: "Learn at your pace",   body: "All content is on-demand. Resume exactly where you left off, on any device." },
  { icon: Shield, title: "30-day guarantee",     body: "Not satisfied? Full refund within 30 days — no questions asked." },
  { icon: Users,  title: "Expert instructors",   body: "Hand-picked tutors with real-world experience in their fields." },
  { icon: Star,   title: "Curated quality",      body: "Every course is reviewed before publishing. No filler, no fluff." },
];

const TESTIMONIALS = [
  { name: "Sarah K.", role: "Product Designer", body: "Learnify completely transformed how I approach design. The instructors are the real deal.", rating: 5 },
  { name: "James M.", role: "Software Engineer", body: "Best investment I made in my career. Got promoted within 3 months of completing my course.", rating: 5 },
  { name: "Priya R.", role: "Marketing Manager", body: "The flexibility to learn at my own pace made all the difference. Highly recommended.", rating: 5 },
];

export default async function HomePage() {
  const session = await auth();
  const { featuredCourses, allCategories, totalStudents, avgRating } = await CourseService.getHomeData();

  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#fdf8f0] pt-16 pb-0">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-brand-100/60 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-amber-100/50 blur-3xl" />
        </div>

        <div className="container relative">
          <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-2">
            {/* Left copy */}
            <div className="pb-16 pt-8 lg:pb-24">
              {/* Badge */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-500/10 border border-brand-200 px-4 py-1.5">
                <TrendingUp size={13} className="text-brand-600" />
                <span className="text-xs font-semibold text-brand-700">#1 Rated Learning Platform</span>
              </div>

              <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl xl:text-7xl">
                Online learning<br />
                now in your{" "}
                <span className="text-brand-500 italic">Fingertips</span>
              </h1>

              <p className="mt-5 max-w-lg text-base text-gray-500 leading-relaxed">
                Learning with the experts — expert-led courses across design, development, marketing and more.
                Join {totalStudents > 0 ? `${totalStudents.toLocaleString()}+` : "thousands of"} learners already growing their skills.
              </p>

              {/* Search CTA */}
              <div className="mt-8 flex max-w-md gap-3">
                <Link
                  href="/courses"
                  className="flex flex-1 items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-3.5 text-sm text-gray-400 shadow-sm hover:border-brand-300 transition-colors"
                >
                  <BookOpen size={15} className="flex-shrink-0" />
                  Search for a course or topic…
                </Link>
                <Link
                  href="/courses"
                  className="flex-shrink-0 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-3.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
                >
                  Get Started
                </Link>
              </div>

              {/* Trust row */}
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3">
                {[
                  { icon: Users,         label: `${totalStudents > 0 ? totalStudents.toLocaleString() : "10k"}+ Students` },
                  { icon: Star,          label: `${avgRating}/5 Rating` },
                  { icon: Shield,        label: "30-day guarantee" },
                  { icon: CheckCircle2,  label: "Verified certificates" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Icon size={14} className="text-brand-500 flex-shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Right illustration */}
            <div className="relative hidden lg:flex items-end justify-center">
              {/* Purple backdrop card */}
              <div className="absolute bottom-0 right-8 h-[420px] w-[360px] rounded-t-[200px] bg-brand-500/90" />

              {/* Floating info card */}
              <div className="absolute left-0 top-24 z-10 rounded-2xl bg-gray-900/90 px-4 py-3 text-white shadow-xl backdrop-blur-sm">
                <p className="text-xs font-bold">📚 New course live</p>
                <p className="mt-0.5 text-[11px] text-gray-400">Full-Stack Development 2026</p>
              </div>

              {/* Stats card */}
              <div className="absolute right-0 top-16 z-10 rounded-2xl bg-white px-4 py-3 shadow-xl">
                <p className="text-xs font-semibold text-gray-500">Avg. completion</p>
                <p className="mt-1 font-display text-2xl font-bold text-gray-900">87%</p>
                <div className="mt-1.5 h-1.5 w-32 rounded-full bg-surface-100">
                  <div className="h-1.5 w-[87%] rounded-full bg-brand-500" />
                </div>
              </div>

              {/* Placeholder person silhouette / illustration */}
              <div className="relative z-10 flex h-[440px] w-[320px] items-end justify-center">
                {/* SVG illustration — abstract learning figure */}
                <svg viewBox="0 0 320 440" fill="none" className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
                  {/* Body */}
                  <ellipse cx="160" cy="200" rx="80" ry="90" fill="rgba(255,255,255,0.15)"/>
                  {/* Head */}
                  <circle cx="160" cy="110" r="50" fill="#f5d0a9"/>
                  {/* Glasses */}
                  <rect x="133" y="108" width="20" height="12" rx="6" fill="none" stroke="#374151" strokeWidth="2.5"/>
                  <rect x="167" y="108" width="20" height="12" rx="6" fill="none" stroke="#374151" strokeWidth="2.5"/>
                  <line x1="153" y1="114" x2="167" y2="114" stroke="#374151" strokeWidth="2"/>
                  {/* Hair */}
                  <ellipse cx="160" cy="90" rx="50" ry="28" fill="#1a1a2e"/>
                  <ellipse cx="135" cy="98" rx="18" ry="22" fill="#1a1a2e"/>
                  <ellipse cx="185" cy="98" rx="18" ry="22" fill="#1a1a2e"/>
                  {/* Smile */}
                  <path d="M148 125 Q160 135 172 125" stroke="#c87941" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                  {/* Shirt */}
                  <path d="M100 200 Q100 170 120 165 L160 180 L200 165 Q220 170 220 200 L225 340 L95 340 Z" fill="#ffffff"/>
                  {/* Suspenders */}
                  <rect x="145" y="170" width="8" height="170" rx="4" fill="#ef4444"/>
                  <rect x="167" y="170" width="8" height="170" rx="4" fill="#ef4444"/>
                  {/* Arms - pointing gesture */}
                  <path d="M100 200 Q70 210 55 195 Q45 185 55 175 Q70 165 95 178" fill="#f5d0a9"/>
                  <path d="M220 200 Q250 195 265 185 Q270 180 265 172 Q255 165 235 175" fill="#f5d0a9"/>
                  {/* Pointing hand detail */}
                  <ellipse cx="55" cy="182" rx="12" ry="8" fill="#f5d0a9"/>
                  <ellipse cx="265" cy="178" rx="12" ry="8" fill="#f5d0a9"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────────────────── */}
      <section className="border-y border-surface-100 bg-white py-10">
        <div className="container">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: totalStudents > 0 ? `${(totalStudents / 1000).toFixed(0)}k+` : "10k+", label: "Students Enrolled", icon: Users },
              { value: featuredCourses.length > 0 ? "500+" : "100+", label: "Expert Courses", icon: BookOpen },
              { value: "87%",   label: "Completion Rate",  icon: TrendingUp },
              { value: `${avgRating}/5`, label: "Average Rating", icon: Star },
            ].map(({ value, label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-50">
                  <Icon size={20} className="text-brand-600" />
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ────────────────────────────────────────────────────── */}
      {allCategories.length > 0 && (
        <section className="py-12 bg-white">
          <div className="container">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-gray-900">Browse by Category</h2>
              <Link href="/courses" className="text-sm font-medium text-brand-600 hover:underline flex items-center gap-1">
                All categories <ChevronRight size={14} />
              </Link>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {allCategories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/courses?category=${cat.slug}`}
                  className="rounded-full border border-surface-200 bg-surface-50 px-5 py-2.5 text-sm font-medium text-gray-700 transition-all hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURED COURSES ──────────────────────────────────────────────── */}
      <section className="py-16 bg-surface-50">
        <div className="container">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-brand-600">Top picks</p>
              <h2 className="font-display text-3xl font-bold text-gray-900">Featured Courses</h2>
            </div>
            <Link href="/courses" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
              View all <ChevronRight size={15} />
            </Link>
          </div>
          {featuredCourses.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-surface-200 py-20 text-center">
              <BookOpen size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400">Courses coming soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featuredCourses.map((course) => <CourseCard key={course.id} course={course as CourseListItem} />)}
            </div>
          )}
          <div className="mt-8 text-center sm:hidden">
            <Link href="/courses" className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline">
              View all courses <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── BOOK CTA SECTION ──────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="container">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            {/* Left image area */}
            <div className="relative">
              <div className="relative h-[380px] overflow-hidden rounded-3xl bg-amber-400/20">
                {/* Person SVG illustration */}
                <svg viewBox="0 0 480 380" fill="none" className="absolute bottom-0 left-1/2 h-full -translate-x-1/2" xmlns="http://www.w3.org/2000/svg">
                  {/* Yellow backdrop */}
                  <ellipse cx="240" cy="380" rx="200" ry="60" fill="#fbbf24" opacity="0.3"/>
                  {/* Standing figure */}
                  <circle cx="240" cy="110" r="55" fill="#f5c28c"/>
                  <ellipse cx="240" cy="85" rx="55" ry="32" fill="#7c3aed"/>
                  {/* Body */}
                  <path d="M165 220 Q165 185 185 178 L240 195 L295 178 Q315 185 315 220 L320 380 L160 380 Z" fill="#f59e0b"/>
                  {/* Pointing arm */}
                  <path d="M165 220 Q135 215 115 205 Q105 200 110 190 Q120 180 145 195" fill="#f5c28c"/>
                  <ellipse cx="112" cy="196" rx="14" ry="9" fill="#f5c28c"/>
                  {/* Face details */}
                  <circle cx="225" cy="118" r="5" fill="#7c3aed"/>
                  <circle cx="255" cy="118" r="5" fill="#7c3aed"/>
                  <path d="M228 132 Q240 142 252 132" stroke="#c87941" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
                  {/* Headband */}
                  <path d="M185 95 Q240 70 295 95" stroke="#f59e0b" strokeWidth="8" fill="none" strokeLinecap="round"/>
                </svg>

                {/* Floating card */}
                <div className="absolute right-4 top-8 rounded-2xl bg-brand-500 px-4 py-3 text-white shadow-lg">
                  <p className="text-xs font-semibold">Enroll today</p>
                  <p className="text-[11px] text-brand-200 mt-0.5">Join 10k+ learners</p>
                </div>

                {/* Certificate badge */}
                <div className="absolute bottom-8 left-4 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400">
                    <Award size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900">Get Certified</p>
                    <p className="text-[10px] text-gray-500">Industry-recognised</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right copy */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-600">Why Learnify</p>
              <h2 className="font-display text-4xl font-extrabold leading-tight text-gray-900">
                Book Our Courses &{" "}
                <span className="text-brand-500">Improve</span> Your Skills
              </h2>
              <p className="mt-4 text-base text-gray-500 leading-relaxed">
                Learning with the experts — we offer a range of courses across design, development, marketing and business to help you grow.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3">
                {[
                  "Critical Solutions", "Creativity",
                  "Digital Literacy", "Communication",
                  "Problem Solving", "Career Growth",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-gray-700">
                    <CheckCircle2 size={16} className="flex-shrink-0 text-brand-500" />
                    {item}
                  </div>
                ))}
              </div>

              <div className="mt-10 flex gap-4">
                <Link
                  href="/courses"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
                >
                  Browse Courses <ArrowRight size={16} />
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl border border-surface-200 px-6 py-3.5 text-sm font-semibold text-gray-700 hover:bg-surface-50 transition-colors"
                >
                  <Play size={14} className="text-brand-500" /> Free Trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ─────────────────────────────────────────────────── */}
      <section className="py-16 bg-surface-50">
        <div className="container">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-600">Why us</p>
            <h2 className="font-display text-3xl font-bold text-gray-900">Built for serious learners</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card p-6 hover:-translate-y-1 transition-transform duration-200">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                  <Icon size={20} className="text-brand-600" />
                </div>
                <h3 className="mb-2 font-display text-base font-bold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-600">Reviews</p>
            <h2 className="font-display text-3xl font-bold text-gray-900">
              What Our Students Say
            </h2>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={18} className="fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="font-bold text-gray-900">{avgRating}</span>
              <span className="text-sm text-gray-400">average rating</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {TESTIMONIALS.map(({ name, role, body, rating }) => (
              <div key={name} className="card p-6">
                <div className="mb-4 flex">
                  {[...Array(rating)].map((_, i) => (
                    <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed italic">"{body}"</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 text-sm">
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-400">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER CTA ────────────────────────────────────────────────── */}
      <section className="py-16 bg-amber-400">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold text-gray-900">
              Stay in Touch — Get the Latest Courses
            </h2>
            <p className="mt-3 text-sm text-amber-900/80">
              Learning with the experts — get notified when new courses drop in your area of interest.
            </p>
            <div className="mt-8 flex gap-3 justify-center flex-col sm:flex-row">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 max-w-xs rounded-xl border-0 bg-white/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-gray-900/20"
              />
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
              >
                Subscribe
              </Link>
            </div>
            <p className="mt-3 text-xs text-amber-900/60">No spam. Unsubscribe at any time.</p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      {!session && (
        <section className="py-20 bg-surface-900">
          <div className="container text-center">
            <h2 className="font-display text-4xl font-extrabold text-white">Start learning today</h2>
            <p className="mx-auto mt-4 max-w-xl text-gray-400">
              Create a free account and browse hundreds of courses. Your first step forward is one click away.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-8 py-4 font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                Get started free <ArrowRight size={18} />
              </Link>
              <Link
                href="/courses"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-8 py-4 font-medium text-white hover:bg-white/10 transition-colors"
              >
                Browse courses
              </Link>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
