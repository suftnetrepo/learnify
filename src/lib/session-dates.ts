export type SessionDateInput = Date | string;

function asDate(value: SessionDateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function isSameSessionDay(start: SessionDateInput, end: SessionDateInput): boolean {
  return asDate(start).toDateString() === asDate(end).toDateString();
}

export function formatSessionDateRange(
  start: SessionDateInput,
  end: SessionDateInput,
  style: "compact" | "long" = "compact"
): string {
  const startDate = asDate(start);
  const endDate   = asDate(end);
  const options: Intl.DateTimeFormatOptions = style === "long"
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "short", year: "numeric" };
  const formatter = new Intl.DateTimeFormat("en-GB", options);

  if (isSameSessionDay(startDate, endDate)) return formatter.format(startDate);
  return `${formatter.format(startDate)} – ${formatter.format(endDate)}`;
}

export function formatSessionTimeRange(start: SessionDateInput, end: SessionDateInput): string {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatter.format(asDate(start))} – ${formatter.format(asDate(end))}`;
}

/** True when the calendar day falls anywhere inside a session's date range. */
export function sessionCoversDay(
  start: SessionDateInput,
  end: SessionDateInput,
  day: SessionDateInput
): boolean {
  const dayKey = (value: SessionDateInput) => {
    const date = asDate(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };

  const target = dayKey(day);
  return target >= dayKey(start) && target <= dayKey(end);
}
