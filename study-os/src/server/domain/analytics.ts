// Every formula here is defined precisely in docs/analytics.md — this file
// is the implementation, not a second source of truth for the definitions.
import type { PrismaClient } from "@/generated/prisma/client";
import { IntervalType } from "@/generated/prisma/enums";
import { addDays } from "./calendar";

export interface DailyTotal {
  date: Date;
  focusSeconds: number;
  breakSeconds: number;
}

/** One row per calendar day in [start, end] that has any recorded time. Days with nothing get no row. */
export async function getDailyTotals(
  prisma: PrismaClient,
  userId: string,
  start: Date,
  end: Date,
): Promise<DailyTotal[]> {
  const rows = await prisma.sessionInterval.groupBy({
    by: ["localDate", "type"],
    where: { userId, localDate: { gte: start, lte: end } },
    _sum: { durationSeconds: true },
  });

  const map = new Map<string, DailyTotal>();
  for (const row of rows) {
    const key = row.localDate.toISOString();
    const entry = map.get(key) ?? { date: row.localDate, focusSeconds: 0, breakSeconds: 0 };
    const seconds = row._sum.durationSeconds ?? 0;
    if (row.type === IntervalType.FOCUS) entry.focusSeconds += seconds;
    else entry.breakSeconds += seconds;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function sumFocusSeconds(totals: DailyTotal[]): number {
  return totals.reduce((sum, t) => sum + t.focusSeconds, 0);
}

export function sumBreakSeconds(totals: DailyTotal[]): number {
  return totals.reduce((sum, t) => sum + t.breakSeconds, 0);
}

/** A "study day" per docs/analytics.md: daily focus >= the configured threshold. */
export function studyDaysFrom(totals: DailyTotal[], thresholdSeconds: number): Date[] {
  return totals.filter((t) => t.focusSeconds >= thresholdSeconds).map((t) => t.date);
}

export function studyDayAverage(totalFocusSeconds: number, studyDaysCount: number): number {
  return studyDaysCount === 0 ? 0 : totalFocusSeconds / studyDaysCount;
}

export function calendarDayAverage(totalFocusSeconds: number, calendarDaysCount: number): number {
  return calendarDaysCount === 0 ? 0 : totalFocusSeconds / calendarDaysCount;
}

export function consistency(studyDaysCount: number, calendarDaysCount: number): number {
  return calendarDaysCount === 0 ? 0 : studyDaysCount / calendarDaysCount;
}

export interface StreakInfo {
  current: number;
  longest: number;
}

/**
 * Streak per docs/analytics.md: current streak ends today OR yesterday (a
 * day not yet studied doesn't break it until a full day has passed with no
 * qualifying time); longest streak uses strict day-adjacency over history.
 */
export function computeStreaks(studyDays: Date[], today: Date): StreakInfo {
  if (studyDays.length === 0) return { current: 0, longest: 0 };

  const sorted = [...studyDays].sort((a, b) => a.getTime() - b.getTime());
  const set = new Set(sorted.map((d) => d.getTime()));

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (addDays(sorted[i - 1], 1).getTime() === sorted[i].getTime()) {
      run++;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  let anchor: Date;
  if (set.has(today.getTime())) {
    anchor = today;
  } else {
    const yesterday = addDays(today, -1);
    if (!set.has(yesterday.getTime())) return { current: 0, longest };
    anchor = yesterday;
  }

  let current = 0;
  let cursor = anchor;
  while (set.has(cursor.getTime())) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { current, longest };
}

export interface CategoryTotal {
  categoryId: string | null;
  categoryName: string;
  color: string;
  focusSeconds: number;
}

/** Category/skill distribution (single unified taxonomy — docs/database.md). */
export async function getCategoryDistribution(
  prisma: PrismaClient,
  userId: string,
  start: Date,
  end: Date,
): Promise<CategoryTotal[]> {
  const intervals = await prisma.sessionInterval.findMany({
    where: { userId, type: IntervalType.FOCUS, localDate: { gte: start, lte: end } },
    select: {
      durationSeconds: true,
      session: { select: { categoryId: true, category: { select: { name: true, color: true } } } },
    },
  });

  const map = new Map<string, CategoryTotal>();
  for (const iv of intervals) {
    const key = iv.session.categoryId ?? "__uncategorized__";
    const entry = map.get(key) ?? {
      categoryId: iv.session.categoryId,
      categoryName: iv.session.category?.name ?? "Uncategorized",
      color: iv.session.category?.color ?? "#9a9a92",
      focusSeconds: 0,
    };
    entry.focusSeconds += iv.durationSeconds ?? 0;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.focusSeconds - a.focusSeconds);
}

/**
 * Data-only "neglected skill" note per spec §26: flags a category whose
 * share of total time this range is less than half its share in the prior
 * range, or that has zero time now but had time in the prior range. No
 * invented thresholds beyond that.
 */
export function findNeglectedCategory(
  current: CategoryTotal[],
  previous: CategoryTotal[],
): { categoryName: string } | null {
  const currentTotal = current.reduce((s, c) => s + c.focusSeconds, 0);
  const previousTotal = previous.reduce((s, c) => s + c.focusSeconds, 0);
  if (currentTotal === 0 || previousTotal === 0) return null;

  for (const prev of previous) {
    const prevShare = prev.focusSeconds / previousTotal;
    if (prevShare <= 0) continue;
    const cur = current.find((c) => c.categoryId === prev.categoryId);
    const curShare = cur ? cur.focusSeconds / currentTotal : 0;
    if (curShare < prevShare / 2) {
      return { categoryName: prev.categoryName };
    }
  }
  return null;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null; // caller renders "New" instead of dividing by zero
  return (current - previous) / previous;
}
