import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── Tailwind ─────────────────────────────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Password ─────────────────────────────────────────────────────────────────
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function generateTokenExpiry(hours = 24): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
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

export function generateUniqueSlug(title: string): string {
  const base = slugify(title);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
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
