// Personal records (spec §22/§58): always computed live from SessionInterval
// / StudySession — never stored — so deleting or editing a session can never
// leave a stale record. See docs/database.md §Why no DailyStats/Records tables.
import type { PrismaClient } from "@/generated/prisma/client";
import { GoalPeriod, IntervalType, SessionStatus } from "@/generated/prisma/enums";
import { computeStreaks, getDailyTotals, studyDaysFrom, type DailyTotal } from "./analytics";
import { monthKey, startOfMonth, startOfWeek, weekKey } from "./calendar";

export interface PersonalRecords {
  longestStudyDay: { seconds: number; date: Date | null };
  longestSession: { seconds: number; sessionId: string | null };
  longestStreak: number;
  mostStudyDaysInMonth: { count: number; month: string | null };
  mostFocusInWeek: { seconds: number; week: Date | null };
  mostFocusInMonth: { seconds: number; month: string | null };
  mostSessionsInDay: { count: number; date: Date | null };
  highestDailyGoalSeconds: number;
  highestWeeklyGoalSeconds: number;
  highestMonthlyGoalSeconds: number;
}

function maxByOrNull<T>(items: T[], key: (t: T) => number): T | null {
  if (items.length === 0) return null;
  return items.reduce((best, cur) => (key(cur) > key(best) ? cur : best));
}

export async function computePersonalRecords(
  prisma: PrismaClient,
  userId: string,
  today: Date,
  streakThresholdSeconds: number,
): Promise<PersonalRecords> {
  // Full history — fine at single-user scale (at most a few thousand days).
  const epoch = new Date(0);
  const dailyTotals = await getDailyTotals(prisma, userId, epoch, today);

  const longestDay = maxByOrNull(dailyTotals, (d) => d.focusSeconds);
  const studyDays = studyDaysFrom(dailyTotals, streakThresholdSeconds);
  const { longest: longestStreak } = computeStreaks(studyDays, today);

  const weekly = rollup(dailyTotals, weekKey, (d) => startOfWeek(d.date));
  const monthly = rollup(dailyTotals, monthKey, (d) => startOfMonth(d.date));

  const studyDaysByMonth = new Map<string, number>();
  for (const day of studyDays) {
    const key = monthKey(day);
    studyDaysByMonth.set(key, (studyDaysByMonth.get(key) ?? 0) + 1);
  }
  const bestMonthByStudyDays = maxByOrNull(
    [...studyDaysByMonth.entries()],
    ([, count]) => count,
  );

  const longestSession = await prisma.studySession.findFirst({
    where: { userId, status: SessionStatus.COMPLETED },
    orderBy: { focusSeconds: "desc" },
    select: { id: true, focusSeconds: true },
  });

  const sessionsPerDay = await getDistinctSessionsPerDay(prisma, userId);
  const bestSessionsDay = maxByOrNull([...sessionsPerDay.entries()], ([, count]) => count);

  const highestGoal = async (period: GoalPeriod) => {
    const row = await prisma.goal.findFirst({ where: { userId, period }, orderBy: { seconds: "desc" } });
    return row?.seconds ?? 0;
  };

  const bestWeek = maxByOrNull([...weekly.entries()], ([, seconds]) => seconds);
  const bestMonth = maxByOrNull([...monthly.entries()], ([, seconds]) => seconds);

  return {
    longestStudyDay: { seconds: longestDay?.focusSeconds ?? 0, date: longestDay?.date ?? null },
    longestSession: { seconds: longestSession?.focusSeconds ?? 0, sessionId: longestSession?.id ?? null },
    longestStreak,
    mostStudyDaysInMonth: {
      count: bestMonthByStudyDays?.[1] ?? 0,
      month: bestMonthByStudyDays?.[0] ?? null,
    },
    mostFocusInWeek: { seconds: bestWeek?.[1] ?? 0, week: bestWeek ? new Date(bestWeek[0]) : null },
    mostFocusInMonth: { seconds: bestMonth?.[1] ?? 0, month: bestMonth?.[0] ?? null },
    mostSessionsInDay: {
      count: bestSessionsDay?.[1] ?? 0,
      date: bestSessionsDay ? new Date(bestSessionsDay[0]) : null,
    },
    highestDailyGoalSeconds: await highestGoal(GoalPeriod.DAILY),
    highestWeeklyGoalSeconds: await highestGoal(GoalPeriod.WEEKLY),
    highestMonthlyGoalSeconds: await highestGoal(GoalPeriod.MONTHLY),
  };
}

function rollup(
  dailyTotals: DailyTotal[],
  keyFn: (date: Date) => string,
  bucketStart: (t: DailyTotal) => Date,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of dailyTotals) {
    const key = keyFn(bucketStart(t));
    map.set(key, (map.get(key) ?? 0) + t.focusSeconds);
  }
  return map;
}

async function getDistinctSessionsPerDay(prisma: PrismaClient, userId: string): Promise<Map<string, number>> {
  const rows = await prisma.sessionInterval.findMany({
    where: { userId, type: IntervalType.FOCUS },
    select: { localDate: true, sessionId: true },
  });
  const byDay = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = row.localDate.toISOString();
    const set = byDay.get(key) ?? new Set<string>();
    set.add(row.sessionId);
    byDay.set(key, set);
  }
  return new Map([...byDay.entries()].map(([k, v]) => [k, v.size]));
}

/**
 * "Record broken" detection for the record-chasing UX (§23): compares the
 * in-progress period's total-so-far against the record excluding that same
 * period, so a period is never compared against itself while accumulating.
 */
export function isChasingRecord(
  currentPeriodTotalSoFar: number,
  recordExcludingCurrentPeriod: number,
): { broken: boolean; remainingSeconds: number } {
  if (currentPeriodTotalSoFar > recordExcludingCurrentPeriod) {
    return { broken: true, remainingSeconds: 0 };
  }
  return { broken: false, remainingSeconds: recordExcludingCurrentPeriod - currentPeriodTotalSoFar + 1 };
}
