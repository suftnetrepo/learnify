import { Metadata } from "next";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import Link from "next/link";
import { ArrowRight, Clock, Calendar, Tag } from "lucide-react";
import { POSTS, type BlogPost } from "./posts";

export const metadata: Metadata = {
  title: "Blog — Learnify",
  description: "Insights on learning, career development, and the skills that matter most in today's workplace.",
};



const FEATURED = POSTS[0];
const TAGS = ["All", "Career", "Learning", "Learning Science", "Tips", "Productivity", "Opinion"];

export default async function BlogPage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />

      {/* ── HEADER ───────────────────────────────────────────────────── */}
      <section className="bg-[#1c1d1f] py-16">
        <div className="container">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-400">Learnify Blog</p>
          <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl">
            Insights for serious learners
          </h1>
          <p className="mt-4 max-w-xl text-base text-gray-400">
            Practical advice on learning faster, building better skills, and making the career moves that matter.
          </p>
        </div>
      </section>

      {/* ── FEATURED POST ────────────────────────────────────────────── */}
      <section className="border-b border-surface-100 py-12">
        <div className="container">
          <Link href={`/blog/${FEATURED.slug}`} className="group block">
            <div className="grid grid-cols-1 gap-8 rounded-3xl border border-surface-200 p-8 hover:border-brand-200 hover:bg-surface-50 transition-all lg:grid-cols-[1fr_420px]">
              {/* Left */}
              <div className="flex flex-col justify-center">
                <div className="mb-4 flex items-center gap-3">
                  <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
                    Featured
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Tag size={11} />{FEATURED.tag}
                  </span>
                </div>
                <h2 className="font-display text-2xl font-extrabold text-gray-900 leading-tight group-hover:text-brand-600 transition-colors lg:text-3xl">
                  {FEATURED.title}
                </h2>
                <p className="mt-4 text-sm text-gray-500 leading-relaxed">{FEATURED.excerpt}</p>
                <div className="mt-6 flex items-center gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${FEATURED.color} text-xs font-bold text-white`}>
                      {FEATURED.authorInit}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">{FEATURED.author}</p>
                      <p className="text-xs text-gray-400">{FEATURED.authorRole}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 ml-auto">
                    <span className="flex items-center gap-1"><Calendar size={11} />{FEATURED.date}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{FEATURED.readTime}</span>
                  </div>
                </div>
              </div>

              {/* Right — decorative */}
              <div className="hidden lg:flex items-center justify-center rounded-2xl bg-brand-50 min-h-[220px]">
                <div className="text-center px-8">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500">
                    <span className="text-3xl text-white font-bold">L</span>
                  </div>
                  <p className="text-sm font-bold text-brand-700">The Learnify Blog</p>
                  <p className="text-xs text-brand-500 mt-1">Practical insights for serious learners</p>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── POSTS GRID ───────────────────────────────────────────────── */}
      <section className="py-12">
        <div className="container">
          {/* Tag filter — static for now */}
          <div className="mb-8 flex flex-wrap gap-2">
            {TAGS.map((tag, i) => (
              <span
                key={tag}
                className={`cursor-pointer rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                  i === 0
                    ? "bg-brand-500 text-white"
                    : "border border-surface-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col rounded-2xl border border-surface-200 bg-white overflow-hidden hover:border-brand-200 hover:shadow-card transition-all duration-200"
              >
                {/* Colour band */}
                <div className={`h-1.5 ${post.color}`} />

                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                      {post.tag}
                    </span>
                  </div>

                  <h3 className="font-display text-lg font-bold text-gray-900 leading-snug group-hover:text-brand-600 transition-colors flex-1">
                    {post.title}
                  </h3>
                  <p className="mt-3 text-sm text-gray-500 leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-surface-100 pt-4">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full ${post.color} text-xs font-bold text-white`}>
                        {post.authorInit}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-700">{post.author}</p>
                        <p className="text-[10px] text-gray-400">{post.date}</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} />{post.readTime}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination placeholder */}
          <div className="mt-12 flex items-center justify-center gap-2">
            {[1, 2, 3].map((n) => (
              <button key={n}
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                  n === 1
                    ? "bg-brand-500 text-white"
                    : "border border-surface-200 text-gray-600 hover:border-brand-300 hover:text-brand-700"
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER ───────────────────────────────────────────────── */}
      <section className="py-16 bg-amber-400">
        <div className="container">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-3xl font-extrabold text-gray-900">Get articles in your inbox</h2>
            <p className="mt-2 text-sm text-amber-900/70">
              New posts every week. No spam, no filler. Unsubscribe at any time.
            </p>
            <div className="mt-6 flex gap-3 justify-center flex-col sm:flex-row">
              <input
                type="email"
                placeholder="you@example.com"
                className="flex-1 max-w-xs rounded-xl border-0 bg-white/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-gray-900/20"
              />
              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors">
                Subscribe <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
