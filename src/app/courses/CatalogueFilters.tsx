"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition, useState, useEffect, useCallback } from "react";
import {
  Search, X, ChevronDown, ChevronUp,
  SlidersHorizontal, RotateCcw,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";

interface Category { id: string; name: string; slug: string }

interface Props {
  categories:      Category[];
  currentCategory: string;
  currentLevel:    string;
  currentFormat:   string;
  currentSort:     string;
  currentSearch:   string;
  mobile?:         boolean;
}

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="py-4 border-b border-surface-100 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between mb-3"
      >
        <span className="text-sm font-semibold text-gray-900">{title}</span>
        {open
          ? <ChevronUp   size={15} className="text-gray-400" />
          : <ChevronDown size={15} className="text-gray-400" />
        }
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  count,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer group">
      <div className="flex items-center gap-3">
        <div
          onClick={onChange}
          className={cn(
            "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-all",
            checked
              ? "bg-brand-500 border-brand-500"
              : "border-surface-300 bg-white group-hover:border-brand-400"
          )}
        >
          {checked && (
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <span className={cn("text-sm transition-colors", checked ? "text-brand-700 font-medium" : "text-gray-600 group-hover:text-gray-900")}>
          {label}
        </span>
      </div>
      {count !== undefined && (
        <span className="text-xs text-gray-400">{count}</span>
      )}
    </label>
  );
}

const SORT_OPTIONS = [
  { value: "popular",    label: "Most popular" },
  { value: "newest",     label: "Newest" },
  { value: "rating",     label: "Highest rated" },
  { value: "price-asc",  label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

const LEVELS = [
  { value: "beginner",     label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced",     label: "Advanced" },
];

const FORMATS = [
  { value: "online",    label: "Online" },
  { value: "in_person", label: "In-person" },
  { value: "hybrid",    label: "Hybrid" },
];

export function CatalogueFilters({
  categories, currentCategory, currentLevel, currentFormat,
  currentSort, currentSearch, mobile,
}: Props) {
  const router              = useRouter();
  const pathname            = usePathname();
  const [, start]           = useTransition();
  const [search, setSearch] = useState(currentSearch);
  const debouncedSearch     = useDebounce(search, 400);

  const buildAndPush = useCallback((overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = {
      search:   currentSearch,
      category: currentCategory,
      level:    currentLevel,
      format:   currentFormat,
      sort:     currentSort,
      ...overrides,
    };
    if (merged.search)   p.set("search",   merged.search);
    if (merged.category) p.set("category", merged.category);
    if (merged.level)    p.set("level",    merged.level);
    if (merged.format)   p.set("format",   merged.format);
    if (merged.sort && merged.sort !== "popular") p.set("sort", merged.sort);
    p.delete("page");
    start(() => router.push(`${pathname}?${p.toString()}`));
  }, [router, pathname, currentSearch, currentCategory, currentLevel, currentFormat, currentSort]);

  useEffect(() => {
    if (debouncedSearch !== currentSearch) {
      buildAndPush({ search: debouncedSearch });
    }
  }, [debouncedSearch]);

  const hasFilters = currentSearch || currentCategory || currentLevel || currentFormat || (currentSort && currentSort !== "popular");

  // ── Mobile bar ──────────────────────────────────────────────────────────────
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const activeFilterCount = [currentCategory, currentLevel, currentFormat].filter(Boolean).length;

  if (mobile) {
    return (
      <>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMobileFilters(true)}
            className="flex h-9 items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-surface-50 transition-colors"
          >
            <SlidersHorizontal size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <select
            value={currentSort || "popular"}
            onChange={(e) => buildAndPush({ sort: e.target.value })}
            className="form-input h-9 flex-1 text-sm"
          >
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Mobile filter drawer */}
        {showMobileFilters && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowMobileFilters(false)} />
            <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg font-bold text-gray-900">Filters</h3>
                <button onClick={() => setShowMobileFilters(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-100 text-gray-500">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Category */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Category</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => buildAndPush({ category: "" })}
                      className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        !currentCategory ? "bg-brand-500 text-white border-brand-500" : "border-surface-200 text-gray-600 hover:border-brand-300")}>
                      All
                    </button>
                    {categories.map((cat) => (
                      <button key={cat.id} onClick={() => buildAndPush({ category: cat.slug })}
                        className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          currentCategory === cat.slug ? "bg-brand-500 text-white border-brand-500" : "border-surface-200 text-gray-600 hover:border-brand-300")}>
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Level */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Level</p>
                  <div className="flex flex-wrap gap-2">
                    {["", "beginner", "intermediate", "advanced"].map((l) => (
                      <button key={l || "all"} onClick={() => buildAndPush({ level: l })}
                        className={cn("rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                          currentLevel === l ? "bg-brand-500 text-white border-brand-500" : "border-surface-200 text-gray-600 hover:border-brand-300")}>
                        {l || "All levels"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format */}
                <div>
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Format</p>
                  <div className="flex flex-wrap gap-2">
                    {[["", "All formats"], ["online", "Online"], ["in_person", "In-person"], ["hybrid", "Hybrid"]].map(([v, l]) => (
                      <button key={v || "all"} onClick={() => buildAndPush({ format: v })}
                        className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          currentFormat === v ? "bg-brand-500 text-white border-brand-500" : "border-surface-200 text-gray-600 hover:border-brand-300")}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={() => { buildAndPush({ category: "", level: "", format: "" }); setShowMobileFilters(false); }}
                  className="flex-1 h-11 rounded-xl border border-surface-200 text-sm font-medium text-gray-700 hover:bg-surface-50">
                  Clear all
                </button>
                <button onClick={() => setShowMobileFilters(false)}
                  className="flex-1 h-11 rounded-xl bg-brand-500 text-sm font-semibold text-white hover:bg-brand-600">
                  Show results
                </button>
              </div>
            </div>
          </>
        )}
      </>
    );
  }

  // ── Desktop sidebar ─────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-surface-200 bg-white shadow-card overflow-hidden">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-brand-500" />
          <span className="text-sm font-bold text-gray-900">Filters</span>
        </div>
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); start(() => router.push(pathname)); }}
            className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
          >
            <RotateCcw size={11} />
            Reset all
          </button>
        )}
      </div>

      <div className="px-5">
        {/* Search */}
        <div className="py-4 border-b border-surface-100">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-9 text-sm h-9"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); buildAndPush({ search: "" }); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors"
                aria-label="Clear"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Category */}
        <FilterSection title="Category">
          <div>
            <Checkbox
              label="All Categories"
              checked={!currentCategory}
              onChange={() => buildAndPush({ category: "" })}
            />
            {categories.map((cat) => (
              <Checkbox
                key={cat.id}
                label={cat.name}
                checked={currentCategory === cat.slug}
                onChange={() => buildAndPush({ category: currentCategory === cat.slug ? "" : cat.slug })}
              />
            ))}
          </div>
        </FilterSection>

        {/* Level */}
        <FilterSection title="Level">
          <div>
            {LEVELS.map(({ value, label }) => (
              <Checkbox
                key={value}
                label={label}
                checked={currentLevel === value}
                onChange={() => buildAndPush({ level: currentLevel === value ? "" : value })}
              />
            ))}
          </div>
        </FilterSection>

        {/* Format */}
        <FilterSection title="Format" defaultOpen={false}>
          <div>
            {FORMATS.map(({ value, label }) => (
              <Checkbox
                key={value}
                label={label}
                checked={currentFormat === value}
                onChange={() => buildAndPush({ format: currentFormat === value ? "" : value })}
              />
            ))}
          </div>
        </FilterSection>

        {/* Sort */}
        <FilterSection title="Sort by" defaultOpen={false}>
          <div>
            {SORT_OPTIONS.map(({ value, label }) => (
              <Checkbox
                key={value}
                label={label}
                checked={(currentSort || "popular") === value}
                onChange={() => buildAndPush({ sort: value })}
              />
            ))}
          </div>
        </FilterSection>
      </div>
    </div>
  );
}
