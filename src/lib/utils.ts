import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Browser-safe helpers only — client components import this file (for cn), so anything that
// needs Node (crypto, bcrypt) lives in ./server-utils instead. Importing crypto here used to
// ship crypto-browserify + stream/buffer/events polyfills and bcryptjs to every page.

// ─── Tailwind ─────────────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Slugs ────────────────────────────────────────────────────────────────────
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// ─── Formatting ───────────────────────────────────────────────────────────────
export function formatCurrency(
  amount: number | string,
  currency = "GBP"
): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function getPaginationMeta(
  total: number,
  page: number,
  limit: number
) {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  };
}

// ─── Stripe ───────────────────────────────────────────────────────────────────
/** Calculate platform fee and tutor payout from a total amount */
export function calculatePlatformFee(
  amount: number,
  feePercent = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? 20)
): { platformFee: number; tutorAmount: number } {
  const platformFee = Math.round(amount * (feePercent / 100) * 100) / 100;
  const tutorAmount = Math.round((amount - platformFee) * 100) / 100;
  return { platformFee, tutorAmount };
}
