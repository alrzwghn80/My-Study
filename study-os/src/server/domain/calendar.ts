// Pure calendar-date arithmetic on the UTC-midnight "plain date" values
// produced by timezone.ts / stored in SessionInterval.localDate. Once a
// date has been resolved to a local calendar date, everything else is
// ordinary Y-M-D math — no further timezone lookups needed. The one
// exception is `todayInTimezone`, which is where "what date is it right
// now" still has to consult the user's timezone.
import { localCalendarDate } from "./timezone";

export function dateFromYmd(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

export function addDays(date: Date, days: number): Date {
  return dateFromYmd(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days);
}

export function addMonths(date: Date, months: number): Date {
  return dateFromYmd(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate());
}

/** Monday-start week. */
export function startOfWeek(date: Date): Date {
  const dow = date.getUTCDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? 6 : dow - 1;
  return addDays(date, -diff);
}

export function startOfMonth(date: Date): Date {
  return dateFromYmd(date.getUTCFullYear(), date.getUTCMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return addDays(addMonths(startOfMonth(date), 1), -1);
}

export function startOfYear(date: Date): Date {
  return dateFromYmd(date.getUTCFullYear(), 0, 1);
}

export function daysBetweenInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function isSameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

export function isBeforeOrSame(a: Date, b: Date): boolean {
  return a.getTime() <= b.getTime();
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function weekKey(date: Date): string {
  return startOfWeek(date).toISOString();
}

/** "Today" as a plain local calendar date, per the user's configured timezone. */
export function todayInTimezone(timezone: string, now: Date = new Date()): Date {
  return localCalendarDate(now, timezone);
}
