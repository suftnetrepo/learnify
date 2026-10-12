import { describe, it, expect } from "vitest";
import { reconcileElements } from "../reconcile";
import type { ExcalidrawElement } from "../types";

const el = (id: string, version: number, extra: Record<string, unknown> = {}): ExcalidrawElement =>
  ({ id, version, versionNonce: version * 7, isDeleted: false, ...extra });

describe("reconcileElements", () => {
  it("accepts a new element", () => {
    const stored = new Map<string, ExcalidrawElement>();
    const { accepted, rejected } = reconcileElements(stored, [el("a", 1)]);
    expect(accepted.map((e) => e.id)).toEqual(["a"]);
    expect(rejected).toEqual([]);
    expect(stored.get("a")?.version).toBe(1);
  });

  it("accepts an element with a higher version", () => {
    const stored = new Map([["a", el("a", 3)]]);
    const { accepted, rejected } = reconcileElements(stored, [el("a", 4, { x: 10 })]);
    expect(accepted).toHaveLength(1);
    expect(rejected).toEqual([]);
    expect(stored.get("a")).toMatchObject({ version: 4, x: 10 });
  });

  it("rejects an equal version and returns the server copy", () => {
    const server = el("a", 3, { x: 1 });
    const stored = new Map([["a", server]]);
    const { accepted, rejected } = reconcileElements(stored, [el("a", 3, { x: 99 })]);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([server]);
    expect(stored.get("a")).toBe(server);
  });

  it("rejects a lower version", () => {
    const server = el("a", 5);
    const stored = new Map([["a", server]]);
    const { accepted, rejected } = reconcileElements(stored, [el("a", 2)]);
    expect(accepted).toEqual([]);
    expect(rejected).toEqual([server]);
    expect(stored.get("a")?.version).toBe(5);
  });

  it("handles a mix of accepted and rejected elements in one call", () => {
    const stored = new Map([["a", el("a", 3)], ["b", el("b", 2)]]);
    const { accepted, rejected } = reconcileElements(stored, [
      el("a", 4),   // newer → accept
      el("b", 2),   // equal → reject
      el("c", 1),   // new   → accept
      el("b", 1),   // older → reject
    ]);
    expect(accepted.map((e) => `${e.id}@${e.version}`)).toEqual(["a@4", "c@1"]);
    expect(rejected.map((e) => `${e.id}@${e.version}`)).toEqual(["b@2", "b@2"]);
    expect([...stored.keys()].sort()).toEqual(["a", "b", "c"]);
  });

  it("treats deletions as ordinary versioned updates", () => {
    const stored = new Map([["a", el("a", 3)]]);
    reconcileElements(stored, [el("a", 4, { isDeleted: true })]);
    expect(stored.get("a")?.isDeleted).toBe(true);
  });

  it("returns empty output for empty input", () => {
    const stored = new Map([["a", el("a", 1)]]);
    expect(reconcileElements(stored, [])).toEqual({ accepted: [], rejected: [] });
    expect(stored.size).toBe(1);
  });
});
