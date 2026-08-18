"use client";

import Link from "next/link";
import { useState } from "react";
import { Sparkles, Menu, X, LayoutDashboard, BookOpen, GraduationCap, ChevronDown } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  session?: { user: { name?: string | null; email?: string | null; role?: string; image?: string | null } } | null;
}

export function Navbar({ session }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);

  const role     = session?.user?.role;
  const dashHref = role === "tutor" ? "/instructor/courses" : role === "admin" ? "/admin" : "/dashboard";
  const initial  = session?.user?.name?.[0]?.toUpperCase() ?? session?.user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-40 border-b border-surface-100 bg-white/95 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-display text-lg font-bold text-gray-900">Learnify</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {!session ? (
            <>
              <Link href="/" className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-800 hover:text-gray-900 transition-colors">Home</Link>
              <Link href="/courses" className="rounded-lg px-3.5 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">Courses</Link>
              <Link href="/about" className="rounded-lg px-3.5 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">About Us</Link>
              <Link href="/blog" className="rounded-lg px-3.5 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">Blog</Link>
              <Link href="/contact" className="rounded-lg px-3.5 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">Contact</Link>
            </>
          ) : (
            <>
              <Link href="/courses" className="rounded-lg px-3.5 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">Courses</Link>
              {role === "tutor"  && <Link href="/instructor/courses" className="rounded-lg px-3.5 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">Teaching</Link>}
              {role === "admin"  && <Link href="/admin"             className="rounded-lg px-3.5 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">Admin</Link>}
              {role === "student"&& <Link href="/dashboard"         className="rounded-lg px-3.5 py-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">My Learning</Link>}
            </>
          )}
        </nav>

        {/* Desktop auth */}
        <div className="hidden items-center gap-3 md:flex">
          {session ? (
            <div className="relative">
              <button
                onClick={() => setDropOpen((v) => !v)}
                className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-1.5 hover:bg-surface-50 transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                  {initial}
                </div>
                <span className="max-w-[120px] truncate text-sm font-medium text-gray-700">
                  {session.user.name ?? session.user.email}
                </span>
                <ChevronDown size={14} className={cn("text-gray-400 transition-transform", dropOpen && "rotate-180")} />
              </button>

              {dropOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-2xl border border-surface-200 bg-white shadow-xl overflow-hidden">
                    <div className="border-b border-surface-100 px-4 py-3">
                      <p className="text-xs font-semibold text-gray-900 truncate">{session.user.name ?? "Account"}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{session.user.email}</p>
                    </div>
                    <div className="py-1">
                      <Link href={dashHref} onClick={() => setDropOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-surface-50 transition-colors">
                        <LayoutDashboard size={15} className="text-gray-400" />
                        Dashboard
                      </Link>
                      {role === "student" && (
                        <Link href="/dashboard" onClick={() => setDropOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-surface-50 transition-colors">
                          <BookOpen size={15} className="text-gray-400" />
                          My Courses
                        </Link>
                      )}
                      {role === "student" && (
                        <Link href="/dashboard/settings" onClick={() => setDropOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-surface-50 transition-colors">
                          <GraduationCap size={15} className="text-gray-400" />
                          Settings
                        </Link>
                      )}
                    </div>
                    <div className="border-t border-surface-100 py-1">
                      <button
                        onClick={() => { setDropOpen(false); signOut({ callbackUrl: "/" }); }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-full border border-surface-200 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-surface-50 hover:border-surface-300 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center rounded-full bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-surface-100 md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-surface-100 bg-white px-4 py-3 space-y-1 md:hidden">
          <Link href="/courses"
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-surface-50"
            onClick={() => setMenuOpen(false)}>
            Courses
          </Link>
          {session ? (
            <>
              <Link href={dashHref}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-surface-50"
                onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
              {role === "student" && (
                <Link href="/dashboard/settings"
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-surface-50"
                  onClick={() => setMenuOpen(false)}>
                  Settings
                </Link>
              )}
              <button
                onClick={() => { setMenuOpen(false); signOut({ callbackUrl: "/" }); }}
                className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-500 hover:bg-red-50"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login"
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-surface-50"
                onClick={() => setMenuOpen(false)}>
                Sign in
              </Link>
              <Link href="/register"
                className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-white bg-brand-500 text-center rounded-xl"
                onClick={() => setMenuOpen(false)}>
                Sign Up
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
