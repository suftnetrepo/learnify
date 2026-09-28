/**
 * Server-only helpers (Node crypto, bcrypt). Keep these out of ./utils — that file is imported
 * by client components, and anything here would be bundled into every page.
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { slugify } from "./utils";

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
export function generateUniqueSlug(title: string): string {
  const base = slugify(title);
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
}
