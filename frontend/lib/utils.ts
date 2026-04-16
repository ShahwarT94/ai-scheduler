// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in local time. */
export function today(): string {
  return toDateString(new Date());
}

/** Formats a Date to YYYY-MM-DD. */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns the Monday of the week containing the given YYYY-MM-DD date. */
export function weekStart(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();                        // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;        // offset to Monday
  d.setDate(d.getDate() + diff);
  return d;
}

/** Returns an array of 7 YYYY-MM-DD strings for Mon–Sun of the week. */
export function weekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toDateString(d);
  });
}

/** Advances (or retreats) a Date by N weeks, returns new Date. */
export function shiftWeek(monday: Date, delta: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + delta * 7);
  return d;
}

/** "2026-04-14" → "Apr 14" */
export function formatShortDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "2026-04-14" → "Monday" */
export function formatWeekday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

/** "13:00" → "1:00 PM" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

/** ISO timestamp → "Apr 14, 2:30 PM" */
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Relative time: "2 hours ago", "just now", etc. */
export function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
