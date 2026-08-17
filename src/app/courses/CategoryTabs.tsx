"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Code2, BarChart2, Palette, Briefcase, Megaphone,
  Camera, Brain, Music, Globe, BookOpen,
} from "lucide-react";

interface Category { id: string; name: string; slug: string }

interface Props {
  categories:      Category[];
  currentCategory: string;
  currentSearch:   string;
  currentSort:     string;
  currentLevel:    string;
  currentFormat:   string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "web-development":      <Code2        size={14} />,
  "data-science":         <BarChart2    size={14} />,
  "design":               <Palette      size={14} />,
  "business":             <Briefcase    size={14} />,
  "marketing":            <Megaphone    size={14} />,
  "photography":          <Camera       size={14} />,
  "personal-development": <Brain        size={14} />,
  "music":                <Music        size={14} />,
};

function buildUrl(params: {
  category?: string;
  search?: string;
  sort?: string;
  level?: string;
  format?: string;
}) {
  const p = new URLSearchParams();
  if (params.category) p.set("category", params.category);
  if (params.search)   p.set("search",   params.search);
  if (params.sort && params.sort !== "popular") p.set("sort", params.sort);
  if (params.level)    p.set("level",    params.level);
  if (params.format)   p.set("format",   params.format);
  const qs = p.toString();
  return `/courses${qs ? `?${qs}` : ""}`;
}

export function CategoryTabs({
  categories, currentCategory, currentSearch,
  currentSort, currentLevel, currentFormat,
}: Props) {
  const sharedParams = {
    search: currentSearch, sort: currentSort,
    level: currentLevel, format: currentFormat,
  };

  return (
    <div className="border-t border-white/[0.08] bg-[#1c1d1f]">
      <div className="container py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={buildUrl(sharedParams)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
              !currentCategory
                ? "bg-white text-brand-700 shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-white/10"
            )}
          >
            <Globe size={13} />
            All Courses
          </Link>

          {categories.map((cat) => {
            const isActive = currentCategory === cat.slug;
            const icon     = CATEGORY_ICONS[cat.slug] ?? <BookOpen size={13} />;
            return (
              <Link
                key={cat.id}
                href={buildUrl({ ...sharedParams, category: cat.slug })}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                  isActive
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                )}
              >
                {icon}
                {cat.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
