"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown, Eye, EyeOff, MessageSquareText, Search, Star, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

interface Review {
  id:           string;
  rating:       number;
  title:        string | null;
  body:         string | null;
  isPublished:  boolean;
  createdAt:    string;
  updatedAt:    string;
  courseId:     string;
  courseTitle:  string;
  courseSlug:   string;
  studentName:  string | null;
  studentEmail: string;
}

interface Props {
  reviews:     Review[];
  total:       number;
  currentPage: number;
  pageSize:    number;
  counts:      { all: number; hidden: number; lowRated: number };
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={13} className={s <= value ? "fill-amber-400 text-amber-400" : "fill-surface-100 text-surface-200"} />
      ))}
    </span>
  );
}

export function ReviewsClient({ reviews, total, currentPage, pageSize, counts }: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { success, error } = useToast();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Review | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== "page") params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }, [searchParams, pathname, router]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateParam("q", value), 350);
  }

  async function moderate(review: Review, action: "hide" | "show" | "delete") {
    setBusy(review.id);
    try {
      const res = await fetch(`/api/reviews/${review.id}`, action === "delete"
        ? { method: "DELETE" }
        : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPublished: action === "show" }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      success(
        action === "delete" ? "Review deleted" : action === "hide" ? "Review hidden" : "Review restored",
        action === "hide" ? "It's no longer shown publicly or counted in the course rating." : "The course rating has been updated."
      );
      startTransition(() => router.refresh());
    } catch (err) {
      error("Couldn't update review", err instanceof Error ? err.message : "Please try again");
    } finally {
      setBusy(null);
      setPendingDelete(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
    .reduce<(number | "...")[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  const visibility = searchParams.get("visibility") ?? "";
  const rating     = searchParams.get("rating") ?? "";
  const filtered   = !!(searchParams.get("q") || visibility || rating);

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold text-gray-900">Reviews</h1>
        <p className="mt-0.5 text-sm text-gray-400">
          {counts.all} review{counts.all !== 1 ? "s" : ""} · {counts.hidden} hidden · {counts.lowRated} published with 1–2 stars
        </p>
      </div>

      {/* Search + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search course, student or review text..."
            className="w-full rounded-xl border border-surface-200 bg-white py-2 pl-9 pr-4 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="relative">
          <select
            value={visibility}
            onChange={(e) => updateParam("visibility", e.target.value)}
            aria-label="Visibility"
            className="appearance-none rounded-xl border border-surface-200 bg-white py-2 pl-3 pr-9 text-sm text-gray-600 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">All reviews</option>
            <option value="published">Published</option>
            <option value="hidden">Hidden</option>
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
        <div className="relative">
          <select
            value={rating}
            onChange={(e) => updateParam("rating", e.target.value)}
            aria-label="Rating"
            className="appearance-none rounded-xl border border-surface-200 bg-white py-2 pl-3 pr-9 text-sm text-gray-600 outline-none transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Any rating</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? "s" : ""}</option>)}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* List */}
      <div className={cn("space-y-3 transition-opacity", isPending && "opacity-60")}>
        {reviews.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-surface-200 py-14 text-center">
            <MessageSquareText size={28} className="text-gray-300" />
            <p className="mt-3 text-sm font-semibold text-gray-600">{filtered ? "No reviews match these filters" : "No reviews yet"}</p>
            <p className="mt-1 text-xs text-gray-400">
              {filtered ? "Try a different search or filter." : `Students can review a course once they've completed ${25}% of it.`}
            </p>
          </div>
        )}
        {reviews.map((r) => (
          <div
            key={r.id}
            className={cn(
              "rounded-2xl border bg-white p-5 shadow-card transition-opacity",
              r.isPublished ? "border-surface-200" : "border-amber-200 bg-amber-50/40",
              busy === r.id && "opacity-50"
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} />
                  {!r.isPublished && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      <EyeOff size={11} /> Hidden
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {fmt(r.createdAt)}{r.updatedAt.slice(0, 16) !== r.createdAt.slice(0, 16) && ` · edited ${fmt(r.updatedAt)}`}
                  </span>
                </div>
                {r.title && <p className="mt-2 font-semibold text-gray-900">{r.title}</p>}
                {r.body
                  ? <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-600">{r.body}</p>
                  : !r.title && <p className="mt-2 text-sm italic text-gray-400">Rating only — no written review.</p>}
                <p className="mt-3 text-xs text-gray-500">
                  <span className="font-medium text-gray-700">{r.studentName ?? "Student"}</span> ({r.studentEmail}) on{" "}
                  <Link href={`/admin/courses/${r.courseId}`} className="font-medium text-brand-600 hover:underline">{r.courseTitle}</Link>
                </p>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                {r.isPublished ? (
                  <button
                    onClick={() => moderate(r, "hide")} disabled={busy === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                  >
                    <EyeOff size={13} /> Hide
                  </button>
                ) : (
                  <button
                    onClick={() => moderate(r, "show")} disabled={busy === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"
                  >
                    <Eye size={13} /> Restore
                  </button>
                )}
                <button
                  onClick={() => setPendingDelete(r)} disabled={busy === r.id}
                  aria-label="Delete review" title="Delete review"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total} reviews
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateParam("page", String(currentPage - 1))} disabled={currentPage <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 text-sm text-gray-500 transition-colors hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
            >‹</button>
            {pageNumbers.map((p, i) => p === "..." ? (
              <span key={`e-${i}`} className="px-1 text-xs text-gray-400">…</span>
            ) : (
              <button
                key={p} onClick={() => updateParam("page", String(p))}
                className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                  p === currentPage ? "bg-brand-500 text-white" : "border border-surface-200 text-gray-500 hover:bg-surface-50")}
              >{p}</button>
            ))}
            <button
              onClick={() => updateParam("page", String(currentPage + 1))} disabled={currentPage >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 text-sm text-gray-500 transition-colors hover:bg-surface-50 disabled:cursor-not-allowed disabled:opacity-40"
            >›</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) moderate(pendingDelete, "delete"); }}
        icon={<Trash2 size={24} />}
        variant="danger"
        title="Delete this review?"
        description={pendingDelete && <>The {pendingDelete.rating}★ review by <span className="font-semibold text-gray-800">{pendingDelete.studentName ?? pendingDelete.studentEmail}</span> will be removed. This can&apos;t be undone — the student could then write a new one.</>}
        confirmLabel="Yes, delete"
        loading={pendingDelete !== null && busy === pendingDelete.id}
      />
    </>
  );
}
