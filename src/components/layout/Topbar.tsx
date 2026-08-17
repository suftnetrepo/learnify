"use client";

import { Bell, Search, Menu } from "lucide-react";
import Link from "next/link";
import { useMobileMenu } from "./DashboardShell";

interface TopbarProps {
  title?:       string;
  breadcrumbs?: { label: string; href?: string }[];
}

export function Topbar({ title, breadcrumbs }: TopbarProps) {
  const { open: openMenu } = useMobileMenu();

  return (
    <header className="flex h-16 items-center justify-between border-b border-surface-100 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger — only visible on small screens */}
        <button
          onClick={openMenu}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-surface-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        {/* Breadcrumb / title */}
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-300">/</span>}
                {b.href ? (
                  <Link href={b.href} className="text-gray-400 hover:text-gray-700 transition-colors truncate max-w-[120px] sm:max-w-none">
                    {b.label}
                  </Link>
                ) : (
                  <span className="font-medium text-gray-900 truncate max-w-[140px] sm:max-w-none">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : title ? (
          <h1 className="heading-3 text-gray-900 truncate">{title}</h1>
        ) : null}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 hover:text-gray-700 transition-colors"
          aria-label="Search"
        >
          <Search size={18} />
        </button>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 hover:text-gray-700 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
