export const SESSION_TIME_ZONE = "Europe/London";

type SessionWindow = {
  startDatetime: Date | string;
  endDatetime: Date | string;
};

const dateKeyFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SESSION_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A lexically sortable YYYY-MM-DD key in the product's UK timezone. */
export function sessionDateKey(value: Date | string): string {
  const parts = dateKeyFormatter.formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Whether any part of a session falls on the supplied UK calendar date. */
export function sessionOccursOnDate(session: SessionWindow, date: Date | string): boolean {
  const dateKey = sessionDateKey(date);
  return sessionDateKey(session.startDatetime) <= dateKey &&
    sessionDateKey(session.endDatetime) >= dateKey;
}

/** Whether the session is in progress at this instant. */
export function sessionIsActiveAt(session: SessionWindow, now: Date): boolean {
  return new Date(session.startDatetime) <= now && new Date(session.endDatetime) >= now;
}

/** Monday-Sunday date anchors for the current UK week. */
export function sessionWeekDays(now: Date): Date[] {
  // Noon UTC safely represents the same UK calendar date across GMT and BST.
  const today = new Date(`${sessionDateKey(now)}T12:00:00.000Z`);
  const weekday = today.getUTCDay();
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return date;
  });
}
