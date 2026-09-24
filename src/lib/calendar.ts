import { toISODate } from "./dates";

export interface MonthRef {
  year: number;
  /** 1 to 12. */
  month: number;
}

export interface GridDay {
  date: string;
  inMonth: boolean;
}

/** Read "YYYY-MM"; anything else (or a missing value) falls back to the month containing `today`. */
export function parseMonth(value: string | undefined | null, today: string): MonthRef {
  const match = value ? /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value) : null;
  if (match) return { year: Number(match[1]), month: Number(match[2]) };
  const [year, month] = today.split("-").map(Number);
  return { year, month };
}

export const monthKey = ({ year, month }: MonthRef) => `${year}-${String(month).padStart(2, "0")}`;

export function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthLabel({ year, month }: MonthRef): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

/** Monday-first weeks covering the month, padded with the neighbouring months' days. */
export function monthGrid({ year, month }: MonthRef): GridDay[][] {
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekCount = Math.ceil((offset + daysInMonth) / 7);

  const weeks: GridDay[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(year, month - 1, 1 - offset + w * 7 + d);
      week.push({ date: toISODate(date), inMonth: date.getMonth() === month - 1 });
    }
    weeks.push(week);
  }
  return weeks;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
