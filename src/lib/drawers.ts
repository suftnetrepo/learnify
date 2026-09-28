"use client";

/**
 * Only one slide-over drawer open at a time (AI Tutor, AI Materials, Messages all use the right
 * edge). A drawer announces itself when it opens; the others close.
 */
const EVENT = "learnify:drawer-open";

export function announceDrawerOpen(id: string): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/** Calls `close` whenever a different drawer opens. Returns the unsubscribe function. */
export function onOtherDrawerOpen(id: string, close: () => void): () => void {
  const handler = (e: Event) => { if ((e as CustomEvent<string>).detail !== id) close(); };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
