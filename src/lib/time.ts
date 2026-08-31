/** Calendar day / month in East Africa Time (UTC+3). Day rolls at midnight EAT. */
export function eatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** True once the EAT calendar month has finished (not the running month). */
export function isEatMonthClosed(monthKey: string, now = new Date()): boolean {
  return monthKey < eatStamp(now).month;
}

export function eatStamp(date = new Date()): { day: string; month: string; monthLabel: string } {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  const month = day.slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    month: "long",
    year: "numeric",
  }).format(date);
  return { day, month, monthLabel };
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Foresignal-style: "July 31, 2026 at 11:56 AM" in EAT. */
export function formatArchiveWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return `${date} at ${time}`;
}

export function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(d);
}

/** Last `count` EAT calendar days, oldest first, including today. */
export function eatDaysBack(count: number, from = new Date()): string[] {
  const today = eatStamp(from).day;
  const [y, m, d] = today.split("-").map(Number);
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1, d - i, 9));
    days.push(eatStamp(dt).day);
  }
  return days;
}

export function formatEatDay(day: string): string {
  const dt = new Date(`${day}T12:00:00+03:00`);
  if (Number.isNaN(dt.getTime())) return day;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Nairobi",
  }).format(dt);
}
