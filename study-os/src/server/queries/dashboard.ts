import "server-only";
import { prisma } from "@/server/db/client";
import { GoalPeriod } from "@/generated/prisma/enums";
import { getActiveSessionForUser } from "@/server/domain/timer";
import {
  addDays,
  daysBetweenInclusive,
  startOfMonth,
  startOfWeek,
  startOfYear,
  todayInTimezone,
} from "@/server/domain/calendar";
import {
  computeStreaks,
  consistency,
  getCategoryDistribution,
  getDailyTotals,
  studyDaysFrom,
  sumFocusSeconds,
  type CategoryTotal,
  type DailyTotal,
} from "@/server/domain/analytics";
import { getEffectiveGoals, evaluateGoalCompletion, type GoalSet } from "@/server/domain/goals";
import { computePersonalRecords, isChasingRecord, type PersonalRecords } from "@/server/domain/records";

export interface DashboardData {
  timezone: string;
  streakThresholdSeconds: number;
  today: Date;
  activeSession: Awaited<ReturnType<typeof getActiveSessionForUser>>;
  categories: { id: string; name: string; color: string }[];
  todayFocusSeconds: number;
  dailyGoals: GoalSet;
  dailyCompletion: { minimum: boolean; target: boolean; stretch: boolean };
  streak: { current: number; longest: number };
  consistency30d: number;
  thisWeekSeconds: number;
  lastWeekSeconds: number;
  thisWeekTotals: DailyTotal[];
  weekStart: Date;
  weeklyGoal: GoalSet;
  records: PersonalRecords;
  yesterdayChase: { yesterdaySeconds: number; todaySeconds: number; remainingToBeat: number; beaten: boolean };
  heatmap: DailyTotal[];
  heatmapStart: Date;
  monthSeconds: number;
  topCategoryThisMonth: CategoryTotal | null;
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });
  const timezone = settings.timezone;
  const today = todayInTimezone(timezone);
  const yesterday = addDays(today, -1);
  const weekStart = startOfWeek(today);
  const lastWeekStart = addDays(weekStart, -7);
  const lastWeekEnd = addDays(weekStart, -1);
  const heatmapStart = startOfYear(today);
  const monthStart = startOfMonth(today);

  const [
    activeSession,
    categories,
    todayTotals,
    thisWeekTotals,
    lastWeekTotals,
    heatmap,
    recentTotals,
    records,
    dailyGoals,
    weeklyGoal,
    monthTotals,
    categoryDistribution,
  ] = await Promise.all([
    getActiveSessionForUser(prisma, userId),
    prisma.category.findMany({ where: { userId, isArchived: false }, orderBy: { sortOrder: "asc" } }),
    getDailyTotals(prisma, userId, yesterday, today),
    getDailyTotals(prisma, userId, weekStart, today),
    getDailyTotals(prisma, userId, lastWeekStart, lastWeekEnd),
    getDailyTotals(prisma, userId, heatmapStart, today),
    getDailyTotals(prisma, userId, addDays(today, -29), today),
    computePersonalRecords(prisma, userId, today, settings.streakThresholdSeconds),
    getEffectiveGoals(prisma, userId, GoalPeriod.DAILY, today),
    getEffectiveGoals(prisma, userId, GoalPeriod.WEEKLY, today),
    getDailyTotals(prisma, userId, monthStart, today),
    getCategoryDistribution(prisma, userId, monthStart, today),
  ]);

  const todayFocusSeconds = todayTotals.find((t) => t.date.getTime() === today.getTime())?.focusSeconds ?? 0;
  const yesterdaySeconds = todayTotals.find((t) => t.date.getTime() === yesterday.getTime())?.focusSeconds ?? 0;

  const studyDays30d = studyDaysFrom(recentTotals, settings.streakThresholdSeconds);
  const allStudyDaysForStreak = studyDaysFrom(heatmap, settings.streakThresholdSeconds);
  const streak = computeStreaks(allStudyDaysForStreak, today);

  const thisWeekSeconds = sumFocusSeconds(thisWeekTotals);
  const lastWeekSeconds = sumFocusSeconds(lastWeekTotals);

  const chase = isChasingRecord(todayFocusSeconds, yesterdaySeconds);

  return {
    timezone,
    streakThresholdSeconds: settings.streakThresholdSeconds,
    today,
    activeSession,
    categories,
    todayFocusSeconds,
    dailyGoals,
    dailyCompletion: evaluateGoalCompletion(todayFocusSeconds, dailyGoals),
    streak,
    consistency30d: consistency(studyDays30d.length, daysBetweenInclusive(addDays(today, -29), today)),
    thisWeekSeconds,
    lastWeekSeconds,
    thisWeekTotals,
    weekStart,
    weeklyGoal,
    records,
    yesterdayChase: {
      yesterdaySeconds,
      todaySeconds: todayFocusSeconds,
      remainingToBeat: chase.remainingSeconds,
      beaten: chase.broken,
    },
    heatmap,
    heatmapStart,
    monthSeconds: sumFocusSeconds(monthTotals),
    topCategoryThisMonth: categoryDistribution[0] ?? null,
  };
}
