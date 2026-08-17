import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-surface-100 bg-white">
      <div className="container py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500">
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="font-display font-bold text-gray-900">Learnify</span>
            </Link>
            <p className="text-xs text-gray-400 leading-relaxed">
              Premium learning for ambitious people.
            </p>
          </div>

          {/* Learn */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Learn</p>
            <ul className="space-y-2">
              {[
                { label: "Browse Courses", href: "/courses" },
                { label: "Categories",     href: "/courses" },
                { label: "Dashboard",      href: "/dashboard" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Teach */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Teach</p>
            <ul className="space-y-2">
              {[
                { label: "Become an Instructor", href: "/register?role=tutor" },
                { label: "Instructor Dashboard", href: "/instructor/courses" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Company</p>
            <ul className="space-y-2">
              {[
                { label: "About Us",       href: "/about" },
    { label: "Blog",           href: "/blog" },
    { label: "Contact Us",     href: "/contact" },
    { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Use",   href: "/terms" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-surface-100 pt-8 sm:flex-row">
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Learnify. All rights reserved.
          </p>
          <p className="text-xs text-gray-300">
            Secure payments via Stripe · Content delivered via Cloudinary
          </p>
        </div>
      </div>
    </footer>
  );
}
