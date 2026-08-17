import { Metadata } from "next";
import { CourseService } from "@/services";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CourseCard } from "@/components/course/CourseCard";
import { CatalogueFilters } from "./CatalogueFilters";
import { CategoryTabs } from "./CategoryTabs";
import { auth } from "@/lib/auth";
import { BookOpen } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Browse Courses",
  description: "Discover expert-led courses across web development, data science, design, and more.",
};

interface PageProps {
  searchParams: Promise<{
    search?:   string;
    category?: string;
    level?:    string;
    format?:   string;
    sort?:     string;
    page?:     string;
  }>;
}

const PER_PAGE = 12;

export default async function CoursesPage({ searchParams }: PageProps) {
  const session = await auth();
  const params  = await searchParams;

  const page         = Math.max(1, Number(params.page ?? 1));
  const search       = params.search   ?? "";
  const level        = params.level    ?? "";
  const format       = params.format   ?? "";
  const sort         = params.sort     ?? "popular";
  const categorySlug = params.category ?? "";

  const {
    courses: rows,
    total,
    totalPages,
    allCategories,
    page: currentPage,
  } = await CourseService.listPublic({
    search:       search || undefined,
    categorySlug: categorySlug || undefined,
    level:        level || undefined,
    format:       format || undefined,
    sort,
    page,
    limit: PER_PAGE,
  });

  const activeCategory = allCategories.find((c) => c.slug === categorySlug) ?? null;

  const pageTitle =
    search       ? `"${search}"` :
    activeCategory ? activeCategory.name :
    "All Courses";

  return (
    <div className="min-h-screen bg-white">
      <Navbar session={session} />

      {/* ── Hero + Tabs — one seamless dark section ─────────────────────── */}
      <div className="relative overflow-hidden bg-[#1c1d1f]">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-brand-600/20 blur-[80px]" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-brand-500/10 blur-[60px]" />
        </div>

        <div className="container relative py-12">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-gray-500">
            <a href="/" className="hover:text-gray-300 transition-colors">Home</a>
            <span>/</span>
            <span className="text-gray-400">{activeCategory ? activeCategory.name : search ? "Search" : "Courses"}</span>
          </nav>

          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-400">
            {activeCategory ? "Category" : search ? "Search results" : "Catalogue"}
          </p>
          <h1 className="font-display text-4xl font-extrabold text-white tracking-tight lg:text-5xl">
            {pageTitle}
          </h1>
          <p className="mt-3 text-sm text-gray-400">
            {total} course{total !== 1 ? "s" : ""} available
          </p>

          {/* Search bar — premium */}
          <form method="GET" action="/courses" className="mt-7 flex max-w-xl">
            {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
            {level        && <input type="hidden" name="level"    value={level} />}
            {format       && <input type="hidden" name="format"   value={format} />}
            {sort !== "popular" && <input type="hidden" name="sort" value={sort} />}
            <div className="flex h-12 w-full items-center rounded-2xl bg-white/[0.07] ring-1 ring-white/10 focus-within:bg-white/[0.11] focus-within:ring-brand-400 transition-all overflow-hidden">
              <svg className="ml-4 flex-shrink-0 text-gray-400" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                name="search"
                defaultValue={search}
                placeholder="Search for a course or topic…"
                className="h-full flex-1 bg-transparent px-3 text-sm text-white placeholder:text-gray-500 outline-none"
              />
              <button type="submit"
                className="my-1 mr-1 flex-shrink-0 rounded-xl bg-brand-500 px-5 h-10 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
                Search
              </button>
            </div>
          </form>
        </div>

        {/* Category tabs — wrapped, no scrollbar */}
        <CategoryTabs
          categories={allCategories}
          currentCategory={categorySlug}
          currentSearch={search}
          currentSort={sort}
          currentLevel={level}
          currentFormat={format}
        />
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="container py-8">
        <div className="flex gap-7 items-start">

          {/* Sidebar */}
          <aside className="hidden w-64 flex-shrink-0 lg:block">
            <CatalogueFilters
              categories={allCategories}
              currentCategory={categorySlug}
              currentLevel={level}
              currentFormat={format}
              currentSort={sort}
              currentSearch={search}
            />
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {/* Mobile filters */}
            <div className="mb-5 lg:hidden">
              <CatalogueFilters
                categories={allCategories}
                currentCategory={categorySlug}
                currentLevel={level}
                currentFormat={format}
                currentSort={sort}
                currentSearch={search}
                mobile
              />
            </div>

            {/* Results header row */}
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {search
                  ? `${total} result${total !== 1 ? "s" : ""} for "${search}"`
                  : `Showing ${Math.min((page - 1) * PER_PAGE + 1, total)}–${Math.min(page * PER_PAGE, total)} of ${total} courses`
                }
              </p>
              {/* Sort dropdown */}
              <SortSelect currentSort={sort} currentSearch={search} currentCategory={categorySlug} currentLevel={level} currentFormat={format} />
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-surface-200 bg-white py-20 text-center">
                <BookOpen size={44} className="mb-4 text-gray-200" />
                <h3 className="heading-3 text-gray-700">No courses found</h3>
                <p className="mt-2 text-sm text-gray-400">Try adjusting your search or filters.</p>
                <Link href="/courses" className="btn-primary mt-6 inline-flex">Clear all filters</Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {rows.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-1.5">
                    {page > 1 && (
                      <PaginationLink page={page - 1} label="← Prev" {...{ search, categorySlug, level, format, sort }} />
                    )}
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = totalPages <= 7 ? i + 1 : i + Math.max(1, page - 3);
                      if (p > totalPages) return null;
                      return <PaginationLink key={p} page={p} label={String(p)} active={p === page} {...{ search, categorySlug, level, format, sort }} />;
                    })}
                    {page < totalPages && (
                      <PaginationLink page={page + 1} label="Next →" {...{ search, categorySlug, level, format, sort }} />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

// ─── Sort select (server-safe via Link) ──────────────────────────────────────
function SortSelect({ currentSort, currentSearch, currentCategory, currentLevel, currentFormat }: {
  currentSort: string; currentSearch: string; currentCategory: string; currentLevel: string; currentFormat: string;
}) {
  const opts = [
    { value: "popular",    label: "Most popular" },
    { value: "newest",     label: "Newest" },
    { value: "rating",     label: "Highest rated" },
    { value: "price-asc",  label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
  ];
  // We render a client-driven select via the CatalogueFilters mobile component
  // For desktop, use a simple native select that updates via form GET
  return (
    <form method="GET" action="/courses">
      {currentSearch   && <input type="hidden" name="search"   value={currentSearch} />}
      {currentCategory && <input type="hidden" name="category" value={currentCategory} />}
      {currentLevel    && <input type="hidden" name="level"    value={currentLevel} />}
      {currentFormat   && <input type="hidden" name="format"   value={currentFormat} />}
      <div className="relative">
        <select
          name="sort"
          defaultValue={currentSort || "popular"}
          
          className="form-input h-9 w-48 appearance-none pr-8 text-sm font-medium cursor-pointer"
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </form>
  );
}

// ─── Pagination link ──────────────────────────────────────────────────────────
function PaginationLink({ page, label, active, search, categorySlug, level, format, sort }: {
  page: number; label: string; active?: boolean;
  search: string; categorySlug: string; level: string; format: string; sort: string;
}) {
  const p = new URLSearchParams();
  if (search)       p.set("search",   search);
  if (categorySlug) p.set("category", categorySlug);
  if (level)        p.set("level",    level);
  if (format)       p.set("format",   format);
  if (sort)         p.set("sort",     sort);
  p.set("page", String(page));
  return (
    <Link
      href={`/courses?${p.toString()}`}
      className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-3 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-500 text-white shadow-sm"
          : "bg-white text-gray-600 border border-surface-200 hover:border-brand-200 hover:text-brand-600"
      }`}
    >
      {label}
    </Link>
  );
}
