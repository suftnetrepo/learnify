"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, Users, GraduationCap, Calendar,
  BarChart3, CreditCard, LogOut, X,
  Award, Settings, CalendarDays, MessageCircle, ChevronRight,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ReactNode;
  roles: string[];
  /** Live count shown on the item — "messages" = unread messages (students, direct chats, course staff) */
  badge?: "messages";
}

const NAV_ITEMS: NavItem[] = [
  // Student
  { label: "Dashboard",    href: "/dashboard",                icon: <LayoutDashboard size={18} />, roles: ["student"] },
  { label: "My Courses",   href: "/dashboard/my-courses",     icon: <BookOpen        size={18} />, roles: ["student"] },
  { label: "Certificates", href: "/dashboard/certificates",   icon: <Award           size={18} />, roles: ["student"] },
  { label: "Calendar",     href: "/dashboard/calendar",       icon: <Calendar        size={18} />, roles: ["student"] },
  { label: "Settings",     href: "/dashboard/settings",       icon: <Settings        size={18} />, roles: ["student"] },
  // Admin
  { label: "Dashboard",  href: "/admin",                 icon: <LayoutDashboard size={18} />, roles: ["admin"] },
  { label: "Courses",    href: "/admin/courses",         icon: <BookOpen        size={18} />, roles: ["admin"] },
  { label: "Tutors",     href: "/admin/tutors",          icon: <GraduationCap   size={18} />, roles: ["admin"] },
  { label: "Analytics",  href: "/admin/analytics",       icon: <BarChart3       size={18} />, roles: ["admin"] },
  { label: "Payments",   href: "/admin/payments",        icon: <CreditCard      size={18} />, roles: ["admin"] },
  { label: "Users",      href: "/admin/users",           icon: <Users           size={18} />, roles: ["admin"] },
  { label: "Messages",   href: "/admin/messages",        icon: <MessageCircle   size={18} />, roles: ["admin"], badge: "messages" },
  // Instructor
  { label: "Dashboard",  href: "/instructor",            icon: <LayoutDashboard size={18} />, roles: ["tutor"] },
  { label: "My Courses", href: "/instructor/courses",    icon: <BookOpen        size={18} />, roles: ["tutor"] },
  { label: "Earnings",   href: "/instructor/earnings",   icon: <CreditCard      size={18} />, roles: ["tutor"] },
  { label: "Sessions",   href: "/instructor/sessions",   icon: <Calendar        size={18} />, roles: ["tutor"] },
  { label: "Calendar",   href: "/instructor/calendar",   icon: <CalendarDays    size={18} />, roles: ["tutor"] },
  { label: "Messages",   href: "/instructor/messages",   icon: <MessageCircle   size={18} />, roles: ["tutor"], badge: "messages" },
];

interface SidebarProps {
  role:     string;
  name?:    string | null;
  email?:   string | null;
  avatar?:  string | null;
  open?:    boolean;
  onClose?: () => void;
}

const UNREAD_REFRESH_MS = 30000;

/** Unread messages for the Messages badge (refreshed every 30s). */
function useUnreadMessages(enabled: boolean) {
  const [count, setCount] = useState(0);
  const [tick,  setTick]  = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/messages?unread=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (!cancelled && body) setCount(body.data.unread ?? 0); })
      .catch(() => {});
    const timer = setTimeout(() => setTick((n) => n + 1), UNREAD_REFRESH_MS);
    // The Messages page announces reads, so the badge clears straight away
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener("learnify:unread-changed", refresh);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener("learnify:unread-changed", refresh); };
  }, [enabled, tick]);
  return count;
}

export function Sidebar({ role, name, email, avatar, open, onClose }: SidebarProps) {
  const pathname       = usePathname();
  const isMobileDrawer = onClose !== undefined;
  const navItems       = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const unreadMessages = useUnreadMessages(navItems.some((item) => item.badge === "messages"));

  // Highlight only the most specific matching item — e.g. "/dashboard" is a
  // literal prefix of "/dashboard/my-courses", so a naive per-item
  // startsWith() check would light up both. Picking the longest matching
  // href means only "My Courses" wins on that route ("Dashboard" only wins
  // on an exact "/dashboard" match).
  const activeHref = navItems
    .map((item) => item.href)
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  useEffect(() => {
    if (isMobileDrawer && onClose) onClose();
  }, [pathname]);

  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  const userAvatar = (
    <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-500 text-xs font-bold text-white">
      {avatar ? <Image src={avatar} alt="" fill sizes="32px" className="object-cover" /> : initials}
    </div>
  );

  const sidebarContent = (
    <aside className="flex h-full w-60 flex-col border-r border-surface-100 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-surface-100">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Edquis" width={48} height={48} className="flex-shrink-0" />
          <span className="font-display text-[15px] font-bold text-gray-900">Edquis</span>
        </Link>
        {isMobileDrawer && (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100"
            aria-label="Close menu"
          >
            <X size={17} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-500 hover:bg-surface-50 hover:text-gray-900"
              )}
            >
              <span className={cn("flex-shrink-0", isActive ? "text-brand-600" : "text-gray-400")}>
                {item.icon}
              </span>
              {item.label}
              {item.badge === "messages" && unreadMessages > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom — user card + sign out */}
      <div className="border-t border-surface-100 p-3 space-y-1">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={17} className="flex-shrink-0" />
          Sign out
        </button>

        {/* User row — for tutors it opens their profile editor (no separate nav item) */}
        {role === "tutor" ? (
          <Link
            href="/instructor/profile"
            onClick={() => isMobileDrawer && onClose?.()}
            aria-current={pathname === "/instructor/profile" ? "page" : undefined}
            title="Edit your profile"
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
              pathname === "/instructor/profile" ? "bg-brand-50" : "hover:bg-surface-50"
            )}
          >
            {userAvatar}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-gray-900">{name}</p>
              <p className="truncate text-[11px] text-gray-400 group-hover:hidden">{email}</p>
              <p className="hidden text-[11px] font-semibold text-brand-600 group-hover:block">Edit profile</p>
            </div>
            <ChevronRight size={15} className="flex-shrink-0 text-gray-300 transition-colors group-hover:text-brand-500" />
          </Link>
        ) : (
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            {userAvatar}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-gray-900">{name}</p>
              <p className="truncate text-[11px] text-gray-400">{email}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  if (isMobileDrawer) {
    return (
      <>
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden",
            open ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={onClose}
        />
        <div className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full transition-transform duration-300 lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}>
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div className="hidden lg:flex h-screen flex-shrink-0">
      {sidebarContent}
    </div>
  );
}
