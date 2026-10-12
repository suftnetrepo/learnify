import type { ExcalidrawElement } from "./types";

export interface ReconcileResult {
  /** Incoming elements that won and were written to the room's map. */
  accepted: ExcalidrawElement[];
  /**
   * The server's copy of each element the client lost on. Sent back to that client so it
   * converges instead of keeping a version nobody else has.
   */
  rejected: ExcalidrawElement[];
}

/**
 * Server-side counterpart of Excalidraw's reconcileElements: an incoming element is accepted
 * if it's new or its version is strictly greater than the stored one. Equal versions are
 * rejected (first write wins), so every client converges on the server's map.
 * Deletions are ordinary updates (isDeleted: true with a bumped version) and follow the same rule.
 */
export function reconcileElements(stored: Map<string, ExcalidrawElement>, incoming: ExcalidrawElement[]): ReconcileResult {
  const accepted: ExcalidrawElement[] = [];
  const rejected: ExcalidrawElement[] = [];

  for (const element of incoming) {
    const existing = stored.get(element.id);
    if (!existing || element.version > existing.version) {
      stored.set(element.id, element);
      accepted.push(element);
    } else {
      rejected.push(existing);
    }
  }
  return { accepted, rejected };
}

/** Excalidraw z-order: fractional `index` strings compare lexically; unindexed elements keep insertion order. */
export function orderedElements(elements: Map<string, ExcalidrawElement>): ExcalidrawElement[] {
  return [...elements.values()].sort((a, b) => {
    if (!a.index || !b.index) return 0;
    return a.index < b.index ? -1 : a.index > b.index ? 1 : 0;
  });
}
