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

/** "1 Feb 2026 – 30 Jun 2026", "From 1 Feb 2026", or null when neither date is set. */
export function formatDateRange(start: string | null, end: string | null): string | null {
  const s = formatDate(start);
  const e = formatDate(end);
  if (s && e) return `${s} – ${e}`;
  if (s) return `From ${s}`;
  if (e) return `Until ${e}`;
  return null;
}
