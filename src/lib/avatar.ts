/**
 * Initials avatars: up to two initials, and a background/text colour pair that looks random but is
 * fixed per person (hashed from a stable key such as their user id), so everyone keeps "their"
 * colour across pages and refreshes. Full class names are listed so Tailwind keeps them.
 */
const PALETTE = [
  "bg-rose-100 text-rose-700",
  "bg-orange-100 text-orange-700",
  "bg-amber-100 text-amber-800",
  "bg-lime-100 text-lime-800",
  "bg-emerald-100 text-emerald-700",
  "bg-teal-100 text-teal-700",
  "bg-cyan-100 text-cyan-800",
  "bg-sky-100 text-sky-700",
  "bg-blue-100 text-blue-700",
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-pink-100 text-pink-700",
] as const;

/** FNV-1a — spreads similar keys (e.g. uuids) evenly across the palette. */
function paletteIndex(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % PALETTE.length;
}

export function avatarColor(key: string): string {
  return PALETTE[paletteIndex(key)];
}

/**
 * Colours for everyone in one list, never repeating while there are colours left: each person
 * gets their own colour unless someone earlier (by key) already has it, then the next free one.
 * Stable for the same set of people.
 */
export function avatarColors(keys: string[]): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<number>();
  for (const key of [...new Set(keys)].sort()) {
    let i = paletteIndex(key);
    for (let tries = 0; used.has(i) && tries < PALETTE.length; tries++) i = (i + 1) % PALETTE.length;
    used.add(i);
    if (used.size >= PALETTE.length) used.clear();   // more people than colours: start reusing
    result.set(key, PALETTE[i]);
  }
  return result;
}

/** "Sarah Chen" → "SC", "Lizzy" → "L", "jay@example.com" → "J". */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0][0] : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}
