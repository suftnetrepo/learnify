import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";

const footerGroups = [
  {
    title: "Explore",
    links: [
      { label: "Browse courses", href: "/courses" },
      { label: "My learning", href: "/dashboard/my-courses" },
      { label: "Learner dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "For educators",
    links: [
      { label: "Become an instructor", href: "/register?role=tutor" },
      { label: "Instructor workspace", href: "/instructor" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Journal", href: "/blog" },
      { label: "Contact", href: "/contact" },
      { label: "Security", href: "/security-policy" },
    ],
  },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-surface-100 bg-white">
      <div className="container py-10 sm:py-14 lg:py-16">
        <div className="overflow-hidden rounded-[2rem] border border-surface-200 bg-surface-50 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.45)]">
          <div className="grid gap-12 px-6 py-9 sm:px-9 sm:py-11 lg:grid-cols-[1.25fr_1.75fr] lg:gap-16 lg:px-12">
            <div className="max-w-md">
              <Link
                href="/"
                aria-label="Edquis home"
                className="inline-flex items-center gap-2.5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-surface-200 bg-white shadow-sm">
                  <Image src="/logo.png" alt="" width={38} height={38} className="h-9 w-9 object-contain" />
                </span>
                <span className="font-display text-xl font-extrabold tracking-tight text-gray-950">Edquis</span>
              </Link>

              <h2 className="mt-6 font-display text-2xl font-bold leading-tight tracking-tight text-gray-950 sm:text-3xl">
                Practical learning for meaningful progress.
              </h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-gray-500">
                Expert-led courses, focused cohorts and learning resources designed to help you build skills you can use.
              </p>

              <Link
                href="/courses"
                className="group mt-6 inline-flex items-center gap-2 rounded-full border border-surface-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:border-brand-200 hover:text-brand-700"
              >
                Explore the course library
                <ArrowUpRight size={15} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </div>

            <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
              {footerGroups.map((group) => (
                <div key={group.title}>
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400">
                    {group.title}
                  </p>
                  <ul className="space-y-3">
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="text-sm font-medium text-gray-600 transition-colors hover:text-brand-700"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="border-t border-surface-200 bg-white/80 px-6 py-5 sm:px-9 lg:px-12">
            <div className="flex flex-col gap-4 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
              <p>© {new Date().getFullYear()} Edquis. All rights reserved.</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="inline-flex items-center gap-1.5 text-gray-500">
                  <ShieldCheck size={14} className="text-brand-600" />
                  Secure learning experience
                </span>
                <Link href="/privacy" className="transition-colors hover:text-gray-800">Privacy</Link>
                <Link href="/terms" className="transition-colors hover:text-gray-800">Terms</Link>
                <Link href="/cookies" className="transition-colors hover:text-gray-800">Cookies</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
