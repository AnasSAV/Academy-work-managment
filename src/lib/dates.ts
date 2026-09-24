const pad = (n: number) => String(n).padStart(2, "0");

/** A Date as a local "YYYY-MM-DD" (not UTC, so it matches the student's calendar day). */
export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"); negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}
