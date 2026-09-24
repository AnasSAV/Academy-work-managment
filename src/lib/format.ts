/** "1 chapter" / "10 chapters"; empty string for zero so callers can skip it. */
export function countLabel(n: number, singular: string, plural = `${singular}s`) {
  return n === 0 ? "" : `${n} ${n === 1 ? singular : plural}`;
}

/** "1 chapter" / "0 chapters": always shows the number. */
export function pluralize(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Format a "YYYY-MM-DD" string without shifting it through the local time zone. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return dateFormat.format(new Date(y, m - 1, d));
}

/** "512 B", "1.4 KB", "12.3 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** Format a full ISO timestamp as a date, e.g. "24 Sept 2026". */
export function formatTimestamp(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

/** "1 Feb 2026 – 30 Jun 2026", "From 1 Feb 2026", or null when neither date is set. */
export function formatDateRange(start: string | null, end: string | null): string | null {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `From ${s}`;
  if (e) return `Until ${e}`;
  return null;
}
