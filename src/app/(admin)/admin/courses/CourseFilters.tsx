"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useTransition, useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

interface CourseFiltersProps {
  search: string;
  status: string;
  format: string;
}

const STATUS_OPTS = [
  { value: "",          label: "All statuses" },
  { value: "published", label: "Published" },
  { value: "draft",     label: "Draft" },
  { value: "archived",  label: "Archived" },
];

const FORMAT_OPTS = [
  { value: "",          label: "All formats" },
  { value: "online",    label: "Online" },
  { value: "in_person", label: "In-person" },
  { value: "hybrid",    label: "Hybrid" },
];

export function CourseFilters({ search: initSearch, status, format }: CourseFiltersProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();
  const [search, setSearch] = useState(initSearch);
  const debouncedSearch = useDebounce(search, 400);

  const update = useCallback((key: string, value: string, newSearch?: string) => {
    const p = new URLSearchParams();
    const s = newSearch !== undefined ? newSearch : initSearch;
    if (s      && key !== "search") p.set("search", s);
    if (status && key !== "status") p.set("status", status);
    if (format && key !== "format") p.set("format", format);
    if (value) p.set(key, value);
    p.delete("page");
    start(() => router.push(`${pathname}?${p.toString()}`));
  }, [router, pathname, initSearch, status, format]);

  useEffect(() => {
    if (debouncedSearch !== initSearch) {
      update("search", debouncedSearch, debouncedSearch);
    }
  }, [debouncedSearch]);

  const hasFilters = search || status || format;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative w-72">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input pl-9 h-9 text-sm"
        />
        {search && (
          <button
            onClick={() => { setSearch(""); update("search", ""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-1.5">
        {STATUS_OPTS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => update("status", value)}
            className={`h-9 rounded-xl px-3.5 text-sm font-medium transition-all duration-150 ${
              status === value
                ? "bg-brand-500 text-white shadow-sm"
                : "bg-white border border-surface-200 text-gray-600 hover:border-brand-200 hover:text-brand-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Format select */}
      <div className="relative">
        <select
          value={format}
          onChange={(e) => update("format", e.target.value)}
          className="form-input h-9 w-40 text-sm pr-8 appearance-none"
        >
          {FORMAT_OPTS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => { setSearch(""); start(() => router.push(pathname)); }}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-600 hover:bg-red-100 transition-colors"
        >
          <X size={13} /> Clear
        </button>
      )}
    </div>
  );
}
