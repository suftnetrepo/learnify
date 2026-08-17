import { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { getPost, getRelated, POSTS } from "../posts";
import Link from "next/link";
import {
  ArrowLeft, Clock, Calendar, Tag,
  ArrowRight, CheckCircle2, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return { title: "Post not found" };
  return {
    title:       `${post.title} | Learnify Blog`,
    description: post.excerpt,
    openGraph: {
      title:       post.title,
      description: post.excerpt,
      type:        "article",
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post     = getPost(slug);
  if (!post) notFound();

  const session = await auth();
  const related = getRelated(slug, 3);

  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div className="bg-[#1c1d1f]">
        <div className="container py-12 lg:py-16">
          {/* Breadcrumb */}
          <Link
            href="/blog"
            className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} /> Back to blog
          </Link>

          {/* Tag */}
          <div className="flex items-center gap-2 mb-4">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white", post.color)}>
              <Tag size={11} /> {post.tag}
            </span>
          </div>

          {/* Title */}
          <h1 className="font-display text-2xl font-extrabold leading-tight text-white max-w-3xl sm:text-3xl lg:text-4xl xl:text-5xl">
            {post.title}
          </h1>

          {/* Excerpt */}
          <p className="mt-4 max-w-2xl text-base text-gray-400 leading-relaxed">
            {post.excerpt}
          </p>

          {/* Author + meta */}
          <div className="mt-8 flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white", post.color)}>
                {post.authorInit}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{post.author}</p>
                <p className="text-xs text-gray-500">{post.authorRole}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <Calendar size={12} /> {post.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={12} /> {post.readTime}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ARTICLE BODY ─────────────────────────────────────────────── */}
      <div className="container py-12 lg:py-16">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 lg:grid-cols-[1fr_260px]">

          {/* Article */}
          <article className="min-w-0">
            {/* Decorative top rule */}
            <div className={cn("mb-8 h-1 w-16 rounded-full", post.color)} />

            {post.content.map((section, i) => {
              if (section.type === "heading") {
                return (
                  <h2 key={i} className="mt-10 mb-4 font-display text-xl font-bold text-gray-900 lg:text-2xl">
                    {section.text}
                  </h2>
                );
              }
              if (section.type === "paragraph") {
                return (
                  <p key={i} className="mb-5 text-base text-gray-600 leading-relaxed">
                    {section.text}
                  </p>
                );
              }
              if (section.type === "list" && section.items) {
                return (
                  <ul key={i} className="mb-6 space-y-3">
                    {section.items.map((item, j) => {
                      const [bold, ...rest] = item.split(": ");
                      const hasColon = item.includes(": ");
                      return (
                        <li key={j} className="flex items-start gap-3">
                          <CheckCircle2 size={17} className={cn("mt-0.5 flex-shrink-0", post.color.replace("bg-", "text-"))} />
                          <span className="text-base text-gray-600 leading-relaxed">
                            {hasColon ? (
                              <><strong className="font-semibold text-gray-900">{bold}:</strong> {rest.join(": ")}</>
                            ) : item}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                );
              }
              if (section.type === "callout") {
                return (
                  <div key={i} className={cn(
                    "my-8 rounded-2xl border-l-4 p-6",
                    post.color.replace("bg-", "border-"),
                    "bg-surface-50"
                  )}>
                    <p className={cn("mb-2 text-xs font-bold uppercase tracking-wider", post.color.replace("bg-", "text-"))}>
                      {section.label}
                    </p>
                    <p className="text-base text-gray-700 leading-relaxed italic">
                      <Quote size={14} className="mr-1 inline-block text-gray-400" />
                      {section.text}
                    </p>
                  </div>
                );
              }
              return null;
            })}

            {/* Bottom divider */}
            <div className="mt-12 border-t border-surface-100 pt-8">
              <div className="flex items-center gap-4">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white", post.color)}>
                  {post.authorInit}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{post.author}</p>
                  <p className="text-sm text-gray-400">{post.authorRole}, Learnify</p>
                </div>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* About author */}
            <div className="rounded-2xl border border-surface-200 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">About the author</p>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white flex-shrink-0", post.color)}>
                  {post.authorInit}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{post.author}</p>
                  <p className="text-xs text-gray-400">{post.authorRole}</p>
                </div>
              </div>
            </div>

            {/* Article info */}
            <div className="rounded-2xl border border-surface-200 p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Article info</p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar size={13} className="text-gray-400" /> {post.date}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock size={13} className="text-gray-400" /> {post.readTime}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Tag size={13} className="text-gray-400" /> {post.tag}
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-2xl bg-brand-50 border border-brand-100 p-5">
              <p className="font-display text-sm font-bold text-gray-900 mb-2">
                Ready to put this into practice?
              </p>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                Browse expert-led courses and start building real skills today.
              </p>
              <Link
                href="/courses"
                className="flex h-9 w-full items-center justify-center rounded-xl bg-brand-500 text-xs font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                Browse courses <ArrowRight size={12} className="ml-1.5" />
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* ── RELATED POSTS ─────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="border-t border-surface-100 bg-surface-50 py-14">
          <div className="container">
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-8">More from the blog</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/blog/${p.slug}`}
                  className="group flex flex-col rounded-2xl border border-surface-200 bg-white overflow-hidden hover:border-brand-200 hover:shadow-card transition-all"
                >
                  <div className={cn("h-1.5 w-full", p.color)} />
                  <div className="flex flex-1 flex-col p-5">
                    <span className="mb-2 text-xs font-medium text-gray-400">{p.tag}</span>
                    <h3 className="font-display text-base font-bold text-gray-900 leading-snug group-hover:text-brand-600 transition-colors flex-1">
                      {p.title}
                    </h3>
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-400 border-t border-surface-100 pt-3">
                      <span>{p.author}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {p.readTime}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── NEWSLETTER ───────────────────────────────────────────────── */}
      <section className="py-14 bg-amber-400">
        <div className="container">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-2xl font-extrabold text-gray-900">
              Get articles like this in your inbox
            </h2>
            <p className="mt-2 text-sm text-amber-900/70">
              New posts every week. No spam. Unsubscribe at any time.
            </p>
            <div className="mt-6 flex gap-3 justify-center flex-col sm:flex-row">
              <input
                type="email"
                placeholder="you@example.com"
                className="flex-1 max-w-xs rounded-xl border-0 bg-white/80 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white"
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
