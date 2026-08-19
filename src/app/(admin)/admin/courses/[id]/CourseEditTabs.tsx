"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BookOpen, Users, Calendar, Settings } from "lucide-react";

const TABS = [
  { id: "overview",    label: "Overview",    icon: Settings  },
  { id: "curriculum",  label: "Curriculum",  icon: BookOpen  },
  { id: "tutors",      label: "Tutors",      icon: Users     },
  { id: "sessions",    label: "Sessions",    icon: Calendar  },
] as const;

type TabId = typeof TABS[number]["id"];

interface Props {
  overview:   React.ReactNode;
  curriculum: React.ReactNode;
  tutors:     React.ReactNode;
  sessions:   React.ReactNode;
  defaultTab?: TabId;
}

export function CourseEditTabs({ overview, curriculum, tutors, sessions, defaultTab = "overview" }: Props) {
  const [active, setActive] = useState<TabId>(defaultTab);

  const panels = { overview, curriculum, tutors, sessions };

  // This page lives inside DashboardShell, which already owns the page's one
  // scroll container (`<main><div className="overflow-y-auto">`). Making the
  // tab bar its own `flex-1 overflow-y-auto` region here would nest a second
  // scroll container inside that one — so instead the tab bar just sticks to
  // the top of the shared scroll container as the page scrolls underneath it.
  return (
    <div>
      {/* Tab bar */}
      <div className="sticky top-0 z-10 flex border-b border-surface-100 bg-white px-6 gap-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              active === id
                ? "border-brand-500 text-brand-600"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-surface-300"
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="p-6">
        {panels[active]}
      </div>
    </div>
  );
}
