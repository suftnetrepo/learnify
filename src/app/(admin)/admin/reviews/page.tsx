import { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import { ReviewService, type ReviewVisibility } from "@/services/review.service";
import { ReviewsClient } from "./ReviewsClient";

export const metadata: Metadata = { title: "Reviews | Admin" };

interface PageProps {
  searchParams: Promise<{ q?: string; visibility?: string; rating?: string; page?: string }>;
}

const PAGE_SIZE = 20;

export default async function ReviewsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/login");

  const { q, visibility, rating, page } = await searchParams;
  const vis: ReviewVisibility = visibility === "published" || visibility === "hidden" ? visibility : "all";
  const stars = Number(rating);

  const result = await ReviewService.listForAdmin({
    visibility: vis,
    rating:     stars >= 1 && stars <= 5 ? stars : undefined,
    search:     q || undefined,
    page:       Math.max(1, parseInt(page ?? "1", 10) || 1),
    limit:      PAGE_SIZE,
  });

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Reviews" }]} />
      <div className="p-4 sm:p-6">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface-100" />}>
          <ReviewsClient
            reviews={result.reviews.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }))}
            total={result.total}
            currentPage={result.page}
            pageSize={result.limit}
            counts={result.counts}
          />
        </Suspense>
      </div>
    </div>
  );
}
