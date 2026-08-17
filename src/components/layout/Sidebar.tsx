"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, Users, GraduationCap, Calendar,
  BarChart3, Settings, CreditCard, LogOut,
  ChevronLeft, Sparkles, X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface NavItem {
  label: string;
  href:  string;
  icon:  React.ReactNode;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",  href: "/dashboard",          icon: <LayoutDashboard size={18} />, roles: ["student","admin"] },
  { label: "Dashboard",  href: "/instructor/courses",  icon: <LayoutDashboard size={18} />, roles: ["tutor"] },
  { label: "My Courses", href: "/instructor/courses", icon: <BookOpen        size={18} />, roles: ["tutor"] },
  { label: "Earnings",   href: "/instructor/earnings",icon: <CreditCard      size={18} />, roles: ["tutor"] },
  { label: "Sessions",   href: "/instructor/sessions",icon: <Calendar       size={18} />, roles: ["tutor"] },
  { label: "Courses",    href: "/admin/courses",      icon: <BookOpen        size={18} />, roles: ["admin"] },
  { label: "Users",      href: "/admin/users",        icon: <Users           size={18} />, roles: ["admin"] },
  { label: "Tutors",     href: "/admin/tutors",       icon: <GraduationCap   size={18} />, roles: ["admin"] },
  { label: "Analytics",  href: "/admin/analytics",    icon: <BarChart3       size={18} />, roles: ["admin"] },
  { label: "Payments",   href: "/admin/payments",     icon: <CreditCard      size={18} />, roles: ["admin"] },
];

interface SidebarProps {
  role:    string;
  name?:   string | null;
  email?:  string | null;
  avatar?: string | null;
  open?:   boolean;
  onClose?: () => void;
}

export function Sidebar({ role, name, email, avatar, open, onClose }: SidebarProps) {
  const pathname   = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isMobileDrawer = onClose !== undefined;

  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  // Close drawer on route change
  useEffect(() => {
    if (isMobileDrawer && onClose) onClose();
  }, [pathname]);

  const sidebarContent = (
    <aside className={cn(
      "relative flex h-full flex-col border-r border-surface-100 bg-white transition-all duration-300",
      isMobileDrawer ? "w-64" : collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className={cn(
        "flex h-16 items-center border-b border-surface-100 px-4",
        collapsed && !isMobileDrawer ? "justify-center" : "justify-between"
      )}>
        {(!collapsed || isMobileDrawer) && (
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-gray-900">Learnify</span>
          </Link>
        )}
        {collapsed && !isMobileDrawer && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
            <Sparkles size={16} className="text-white" />
          </div>
        )}
        {isMobileDrawer ? (
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-lg text-gray-400",
              "hover:bg-surface-100 hover:text-gray-600 transition-all",
              collapsed && "rotate-180"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                isActive ? "nav-link-active" : "nav-link",
                collapsed && !isMobileDrawer && "justify-center px-0"
              )}
              title={collapsed && !isMobileDrawer ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {(!collapsed || isMobileDrawer) && (
                <span className="flex-1">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-surface-100 p-3 space-y-0.5">
        <Link
          href="/dashboard/settings"
          className={cn("nav-link", collapsed && !isMobileDrawer && "justify-center px-0")}
        >
          <Settings size={18} />
          {(!collapsed || isMobileDrawer) && <span>Settings</span>}
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className={cn(
            "nav-link w-full text-red-500 hover:bg-red-50 hover:text-red-600",
            collapsed && !isMobileDrawer && "justify-center px-0"
          )}
        >
          <LogOut size={18} />
          {(!collapsed || isMobileDrawer) && <span>Sign out</span>}
        </button>

        {(!collapsed || isMobileDrawer) && (
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-surface-50 px-3 py-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-900">{name}</p>
              <p className="truncate text-xs text-gray-400">{email}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );

  if (isMobileDrawer) {
    return (
      <>
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden",
            open ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={onClose}
        />
        {/* Drawer */}
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
