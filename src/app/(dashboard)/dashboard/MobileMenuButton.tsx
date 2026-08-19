"use client";

import { Menu } from "lucide-react";
import { useMobileMenu } from "@/components/layout/DashboardShell";

// The dashboard page below is a server component (it awaits auth() + DB
// queries directly), so the useMobileMenu() context hook — which Topbar
// normally calls internally — can't live there. This is the same hamburger
// button, split out so the page can stay server-rendered.
export function MobileMenuButton() {
  const { open } = useMobileMenu();

  return (
    <button
      onClick={open}
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-surface-100 lg:hidden transition-colors"
      aria-label="Open navigation"
    >
      <Menu size={20} />
    </button>
  );
}
