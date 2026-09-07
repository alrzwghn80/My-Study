import "server-only";
import { prisma } from "@/server/db/client";
import { SessionStatus } from "@/generated/prisma/enums";
import {
  addDays,
  addMonths,
  daysBetweenInclusive,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  startOfYear,
  todayInTimezone,
} from "@/server/domain/calendar";
import {
  calendarDayAverage,
  computeStreaks,
  getCategoryDistribution,
  getDailyTotals,
  percentChange,
  studyDayAverage,
  studyDaysFrom,
  sumFocusSeconds,
  findNeglectedCategory,
  type CategoryTotal,
  type DailyTotal,
} from "@/server/domain/analytics";

export interface WeeklyAnalytics {
  weekStart: Date;
  thisWeekSeconds: number;
  lastWeekSeconds: number;
  changeFraction: number | null;
  dailyTotals: DailyTotal[];
}

export interface MonthlyAnalytics {
  monthStart: Date;
  totalSeconds: number;
  studyDays: number;
  calendarDays: number;
  averagePerCalendarDay: number;
  averagePerStudyDay: number;
  sessionCount: number;
  longestSessionSeconds: number;
  previousMonthSeconds: number;
  changeFraction: number | null;
}

export interface YearlyAnalytics {
  yearStart: Date;
  totalSeconds: number;
  studyDays: number;
  monthlyTotals: { month: Date; seconds: number }[];
  bestMonth: { month: Date; seconds: number } | null;
  worstMonth: { month: Date; seconds: number } | null;
  longestStreak: number;
  totalSessions: number;
}

export interface AnalyticsData {
  timezone: string;
  today: Date;
  weekly: WeeklyAnalytics;
  monthly: MonthlyAnalytics;
  yearly: YearlyAnalytics;
  categoryDistributionYear: CategoryTotal[];
  neglected: { categoryName: string } | null;
}

export async function getAnalyticsData(userId: string): Promise<AnalyticsData> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });
  const timezone = settings.timezone;
  const today = todayInTimezone(timezone);

  const weekStart = startOfWeek(today);
  const lastWeekStart = addDays(weekStart, -7);
  const lastWeekEnd = addDays(weekStart, -1);

  const monthStart = startOfMonth(today);
  const prevMonthStart = addMonths(monthStart, -1);
  const prevMonthEnd = addDays(monthStart, -1);

  const yearStart = startOfYear(today);

  const [
    thisWeekTotals,
    lastWeekTotals,
    monthTotals,
    prevMonthTotals,
    monthSessionAgg,
    yearTotals,
    categoryDistributionYear,
    prevMonthCategoryDistribution,
    thisMonthCategoryDistribution,
  ] = await Promise.all([
    getDailyTotals(prisma, userId, weekStart, today),
    getDailyTotals(prisma, userId, lastWeekStart, lastWeekEnd),
    getDailyTotals(prisma, userId, monthStart, today),
    getDailyTotals(prisma, userId, prevMonthStart, prevMonthEnd),
    prisma.studySession.aggregate({
      where: { userId, status: SessionStatus.COMPLETED, createdAt: { gte: monthStart } },
      _count: { _all: true },
      _max: { focusSeconds: true },
    }),
    getDailyTotals(prisma, userId, yearStart, today),
    getCategoryDistribution(prisma, userId, yearStart, today),
    getCategoryDistribution(prisma, userId, prevMonthStart, prevMonthEnd),
    getCategoryDistribution(prisma, userId, monthStart, today),
  ]);

  const thisWeekSeconds = sumFocusSeconds(thisWeekTotals);
  const lastWeekSeconds = sumFocusSeconds(lastWeekTotals);

  const monthStudyDays = studyDaysFrom(monthTotals, settings.streakThresholdSeconds).length;
  const monthTotalSeconds = sumFocusSeconds(monthTotals);
  const prevMonthTotalSeconds = sumFocusSeconds(prevMonthTotals);

  const yearStudyDays = studyDaysFrom(yearTotals, settings.streakThresholdSeconds);
  const { longest: longestStreak } = computeStreaks(yearStudyDays, today);

  const monthlyTotals: { month: Date; seconds: number }[] = [];
  for (let m = startOfMonth(yearStart); m.getTime() <= monthStart.getTime(); m = addMonths(m, 1)) {
    const mEnd = m.getTime() === monthStart.getTime() ? today : endOfMonth(m);
    const seconds = sumFocusSeconds(yearTotals.filter((t) => t.date.getTime() >= m.getTime() && t.date.getTime() <= mEnd.getTime()));
    monthlyTotals.push({ month: m, seconds });
  }
  const nonZeroMonths = monthlyTotals.filter((m) => m.seconds > 0);
  const bestMonth = nonZeroMonths.length
    ? nonZeroMonths.reduce((best, cur) => (cur.seconds > best.seconds ? cur : best))
    : null;
  const worstMonth = nonZeroMonths.length
    ? nonZeroMonths.reduce((worst, cur) => (cur.seconds < worst.seconds ? cur : worst))
    : null;

  const totalSessionsThisYear = await prisma.studySession.count({
    where: { userId, status: SessionStatus.COMPLETED, createdAt: { gte: yearStart } },
  });

  return {
    timezone,
    today,
    weekly: {
      weekStart,
      thisWeekSeconds,
      lastWeekSeconds,
      changeFraction: percentChange(thisWeekSeconds, lastWeekSeconds),
      dailyTotals: thisWeekTotals,
    },
    monthly: {
      monthStart,
      totalSeconds: monthTotalSeconds,
      studyDays: monthStudyDays,
      calendarDays: daysBetweenInclusive(monthStart, today),
      averagePerCalendarDay: calendarDayAverage(monthTotalSeconds, daysBetweenInclusive(monthStart, today)),
      averagePerStudyDay: studyDayAverage(monthTotalSeconds, monthStudyDays),
      sessionCount: monthSessionAgg._count._all,
      longestSessionSeconds: monthSessionAgg._max.focusSeconds ?? 0,
      previousMonthSeconds: prevMonthTotalSeconds,
      changeFraction: percentChange(monthTotalSeconds, prevMonthTotalSeconds),
    },
    yearly: {
      yearStart,
      totalSeconds: sumFocusSeconds(yearTotals),
      studyDays: yearStudyDays.length,
      monthlyTotals,
      bestMonth,
      worstMonth,
      longestStreak,
      totalSessions: totalSessionsThisYear,
    },
    categoryDistributionYear,
    neglected: findNeglectedCategory(thisMonthCategoryDistribution, prevMonthCategoryDistribution),
  };
}
