import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import Link from "next/link";
import {
  Target, Users, Award, Zap, Shield, Globe,
  CheckCircle2, ArrowRight, Star, TrendingUp, Heart, BookOpen,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About Us — Learnify",
  description: "Learnify is a UK-based premium learning platform built to give every learner access to expert-led, practitioner-built courses that deliver real career results.",
};

const STATS = [
  { value: "50k+",  label: "Students enrolled",       icon: Users },
  { value: "500+",  label: "Expert-led courses",       icon: BookOpen },
  { value: "4.9/5", label: "Average course rating",    icon: Star },
  { value: "87%",   label: "Course completion rate",   icon: TrendingUp },
];

const VALUES = [
  {
    icon: Target,
    title:  "Outcome-driven learning",
    body:   "Every course on Learnify is designed around one question: will this move your career forward? We measure success by what our students achieve, not the hours they spend watching videos.",
  },
  {
    icon: Shield,
    title:  "Quality over quantity",
    body:   "We review every instructor and every course before it goes live. No filler, no recycled content, no beginner padding. If it doesn't meet our standard, it doesn't ship.",
  },
  {
    icon: Heart,
    title:  "Practitioner-led",
    body:   "Our instructors are people who've done the work — engineers, designers, marketers, operators. You learn from experience, not theory.",
  },
  {
    icon: Globe,
    title:  "Built for flexibility",
    body:   "Learn online at your own pace, join a live cohort, or attend in person. Learnify supports every format so you can learn the way that actually fits your life.",
  },
  {
    icon: Award,
    title:  "Credentials that mean something",
    body:   "Every certificate on Learnify is tied to real competency, not just time spent. Employers recognise our certificates because they represent genuine skill.",
  },
  {
    icon: Zap,
    title:  "Transparent by default",
    body:   "No dark patterns, no upsell funnels, no hidden fees. What you see is what you get. And if you're not satisfied within 30 days, you get your money back — no questions asked.",
  },
];

const TEAM = [
  {
    name:  "Alex Morgan",
    role:  "Co-founder & CEO",
    init:  "AM",
    bio:   "Former head of learning at a FTSE 250. Built Learnify after seeing how much talent gets left behind by inaccessible, overpriced education.",
  },
  {
    name:  "Priya Sharma",
    role:  "Co-founder & CTO",
    init:  "PS",
    bio:   "Full-stack engineer with 12 years building EdTech platforms. Previously led engineering at two Series B startups. Obsessed with performance and DX.",
  },
  {
    name:  "James Okafor",
    role:  "Head of Curriculum",
    init:  "JO",
    bio:   "Ex-Google educator and instructional designer. Responsible for the standard every Learnify course is held to — and the process for getting there.",
  },
  {
    name:  "Sophie Chen",
    role:  "Head of Product",
    init:  "SC",
    bio:   "Product designer turned PM. Built consumer products used by millions. At Learnify she keeps the learner experience the most important thing in every room.",
  },
];

const TESTIMONIALS = [
  {
    body:   "Learnify completely changed how I think about upskilling. Within three months of completing the Full-Stack course I landed a role paying 40% more than my previous job.",
    name:   "Sarah J.",
    role:   "Software Engineer, London",
    rating: 5,
  },
  {
    body:   "The quality of instruction is unlike anything else I've tried. These are real practitioners who actually know their field — not educators reading from slides.",
    name:   "Marcus T.",
    role:   "Product Designer, Manchester",
    rating: 5,
  },
  {
    body:   "I've taken courses on every major platform. Learnify is the only one where I actually finished. The quality kept me going.",
    name:   "Amara O.",
    role:   "Marketing Manager, Birmingham",
    rating: 5,
  },
];

const MILESTONES = [
  { year: "2022", event: "Learnify founded in Peterborough, UK with a single course and a conviction that online learning could be better." },
  { year: "2023", event: "First 1,000 students enrolled. Stripe Connect integrated for instructor payouts. First in-person cohort delivered." },
  { year: "2024", event: "Expanded to 200+ courses across 12 categories. Launched live online sessions with Zoom and Teams integration." },
  { year: "2025", event: "Passed 40,000 enrolled students. Launched certificate programme. Opened applications for new instructors." },
  { year: "2026", event: "50,000+ students. 500+ courses. Recognised as one of the UK's fastest-growing EdTech platforms." },
];

export default async function AboutPage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1c1d1f] py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-brand-600/15 blur-[100px]" />
          <div className="absolute -bottom-20 right-0 h-[400px] w-[400px] rounded-full bg-brand-500/10 blur-[80px]" />
        </div>
        <div className="container relative text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
            <span className="text-xs font-semibold text-brand-400">UK-based EdTech</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            Learning that moves<br />
            <span className="text-brand-400">careers forward</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-gray-400 leading-relaxed">
            Learnify is a UK-based premium learning platform built to give every learner access to expert-led,
            practitioner-built courses that deliver real career results — not just certificates.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/courses"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
              Browse courses <ArrowRight size={16} />
            </Link>
            <Link href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 text-sm font-medium text-white hover:bg-white/10 transition-colors">
              Get in touch
            </Link>
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────── */}
      <section className="border-b border-surface-100 bg-surface-50 py-12">
        <div className="container">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50">
                  <Icon size={20} className="text-brand-600" />
                </div>
                <p className="font-display text-3xl font-extrabold text-gray-900">{value}</p>
                <p className="mt-1 text-sm text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MISSION ──────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 items-center">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-600">Our mission</p>
              <h2 className="font-display text-4xl font-extrabold text-gray-900 leading-tight">
                Close the gap between knowledge and opportunity
              </h2>
              <p className="mt-5 text-base text-gray-500 leading-relaxed">
                The world's best education has always been behind paywalls, geography, or gatekeepers.
                We started Learnify because we believe the most important investment anyone can make is in themselves —
                and that shouldn't require a university application, £40,000 of debt, or three years of your life.
              </p>
              <p className="mt-4 text-base text-gray-500 leading-relaxed">
                Every course we publish is built by someone who has done the work. Every feature we ship is
                tested against one question: does this help our students learn better and get further, faster?
              </p>
              <div className="mt-8 space-y-3">
                {[
                  "Practitioner-built courses — no recycled slideshows",
                  "Verified certificates recognised by employers",
                  "Online, in-person, and live cohort formats",
                  "30-day money-back guarantee on every course",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-sm text-gray-700">
                    <CheckCircle2 size={16} className="flex-shrink-0 text-brand-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Visual — timeline */}
            <div className="relative">
              <div className="absolute left-6 top-0 h-full w-px bg-surface-200" />
              <div className="space-y-8 pl-14">
                {MILESTONES.map(({ year, event }) => (
                  <div key={year} className="relative">
                    <div className="absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full border-2 border-brand-500 bg-white text-xs font-bold text-brand-600">
                      {year.slice(2)}
                    </div>
                    <p className="text-xs font-bold text-brand-600 mb-1">{year}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{event}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────────── */}
      <section className="py-20 bg-surface-50">
        <div className="container">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-600">What we stand for</p>
            <h2 className="font-display text-3xl font-extrabold text-gray-900">Our values</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-surface-200 bg-white p-6 hover:-translate-y-1 transition-transform duration-200">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50">
                  <Icon size={20} className="text-brand-600" />
                </div>
                <h3 className="mb-2 font-display text-base font-bold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TEAM ─────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-600">The people behind Learnify</p>
            <h2 className="font-display text-3xl font-extrabold text-gray-900">Meet the team</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-gray-500">
              We&apos;re a small, focused team of builders, educators, and product people — obsessed with making learning better.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map(({ name, role, init, bio }) => (
              <div key={name} className="rounded-2xl border border-surface-200 bg-white p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-2xl font-bold text-white">
                  {init}
                </div>
                <p className="font-display text-base font-bold text-gray-900">{name}</p>
                <p className="mt-0.5 text-xs font-medium text-brand-600">{role}</p>
                <p className="mt-3 text-xs text-gray-500 leading-relaxed">{bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────── */}
      <section className="py-20 bg-[#1c1d1f]">
        <div className="container">
          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-400">Student stories</p>
            <h2 className="font-display text-3xl font-extrabold text-white">Words from our learners</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {TESTIMONIALS.map(({ body, name, role, rating }) => (
              <div key={name} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="mb-4 flex">
                  {Array.from({ length: rating }).map((_, i) => (
                    <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed italic">&ldquo;{body}&rdquo;</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                    {name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{name}</p>
                    <p className="text-xs text-gray-500">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="container text-center">
          <h2 className="font-display text-4xl font-extrabold text-gray-900">Ready to start learning?</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-gray-500">
            Browse 500+ expert-led courses across design, development, business, and more. Your next step forward is one click away.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/courses"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-8 py-4 font-semibold text-white hover:bg-brand-600 transition-colors">
              Browse all courses <ArrowRight size={18} />
            </Link>
            <Link href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-surface-200 px-8 py-4 font-medium text-gray-700 hover:bg-surface-50 transition-colors">
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
