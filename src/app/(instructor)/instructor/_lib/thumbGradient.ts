// Deterministic gradient fallback for course thumbnails — same course id always
// maps to the same gradient, so cards don't flicker between colors on refetch.

export const THUMB_GRADIENTS = [
  "from-indigo-700 to-brand-500",
  "from-sky-700 to-cyan-500",
  "from-emerald-700 to-teal-500",
  "from-violet-700 to-purple-500",
  "from-rose-700 to-pink-500",
];

export function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function gradientFor(id: string) {
  return THUMB_GRADIENTS[hashStr(id) % THUMB_GRADIENTS.length];
}
