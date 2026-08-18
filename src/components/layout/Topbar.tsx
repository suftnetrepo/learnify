"use client";

import { Bell, Search, Menu } from "lucide-react";
import Link from "next/link";
import { useMobileMenu } from "./DashboardShell";

interface TopbarProps {
  title?:       string;
  breadcrumbs?: { label: string; href?: string }[];
  userName?:    string;
  userInitials?: string;
  actions?:     React.ReactNode;
}

export function Topbar({ title, breadcrumbs, actions }: TopbarProps) {
  const { open: openMenu } = useMobileMenu();

  return (
    <header className="flex h-16 items-center justify-between border-b border-surface-100 bg-white px-4 sm:px-6 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={openMenu}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-surface-100 lg:hidden transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>

        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
            {breadcrumbs.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-200">/</span>}
                {b.href ? (
                  <Link href={b.href} className="text-gray-400 hover:text-gray-700 transition-colors">
                    {b.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-gray-900">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : title ? (
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        ) : null}
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {actions}

        <button
          className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-surface-100 hover:text-gray-700 transition-colors"
          aria-label="Search"
        >
          <Search size={17} />
        </button>

        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-surface-100 hover:text-gray-700 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={17} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
