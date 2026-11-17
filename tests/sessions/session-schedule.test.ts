import { describe, expect, it } from "vitest";
import {
  sessionDateKey,
  sessionIsActiveAt,
  sessionOccursOnDate,
  sessionWeekDays,
} from "@/lib/session-schedule";

const multiDaySession = {
  startDatetime: "2026-11-16T09:00:00.000Z",
  endDatetime: "2026-11-20T17:00:00.000Z",
};

describe("instructor session scheduling", () => {
  it("keeps a multi-day session on every covered calendar day", () => {
    expect(sessionOccursOnDate(multiDaySession, "2026-11-16T12:00:00.000Z")).toBe(true);
    expect(sessionOccursOnDate(multiDaySession, "2026-11-17T12:00:00.000Z")).toBe(true);
    expect(sessionOccursOnDate(multiDaySession, "2026-11-20T12:00:00.000Z")).toBe(true);
    expect(sessionOccursOnDate(multiDaySession, "2026-11-21T12:00:00.000Z")).toBe(false);
  });

  it("reports the session active between its start and end instants", () => {
    expect(sessionIsActiveAt(multiDaySession, new Date("2026-11-17T10:00:00.000Z"))).toBe(true);
    expect(sessionIsActiveAt(multiDaySession, new Date("2026-11-21T10:00:00.000Z"))).toBe(false);
  });

  it("builds a Monday-Sunday UK week", () => {
    expect(sessionWeekDays(new Date("2026-11-17T10:00:00.000Z")).map(sessionDateKey)).toEqual([
      "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19",
      "2026-11-20", "2026-11-21", "2026-11-22",
    ]);
  });

  it("uses the UK date around the BST boundary", () => {
    expect(sessionDateKey("2026-06-01T23:30:00.000Z")).toBe("2026-06-02");
  });
});
