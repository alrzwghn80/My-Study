import "server-only";
import { prisma } from "@/server/db/client";
import { SessionStatus } from "@/generated/prisma/enums";
import { getActiveSessionForUser } from "@/server/domain/timer";
import { addDays, todayInTimezone } from "@/server/domain/calendar";
import { getDailyTotals, type DailyTotal } from "@/server/domain/analytics";
import type { SimpleSession } from "@/components/study/RecentSessionsList";

const CHART_DAYS = 7;
const RECENT_SESSIONS_LIMIT = 5;

export interface StudyPageData {
  timezone: string;
  today: Date;
  activeSession: Awaited<ReturnType<typeof getActiveSessionForUser>>;
  todayFocusSeconds: number;
  chartStart: Date;
  chartTotals: DailyTotal[];
  recentSessions: SimpleSession[];
}

export async function getStudyPageData(userId: string): Promise<StudyPageData> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });
  const timezone = settings.timezone;
  const today = todayInTimezone(timezone);
  const chartStart = addDays(today, -(CHART_DAYS - 1));

  const [activeSession, chartTotals, recentSessions] = await Promise.all([
    getActiveSessionForUser(prisma, userId),
    getDailyTotals(prisma, userId, chartStart, today),
    prisma.studySession.findMany({
      where: { userId, status: SessionStatus.COMPLETED },
      orderBy: { createdAt: "desc" },
      take: RECENT_SESSIONS_LIMIT,
      select: { id: true, createdAt: true, focusSeconds: true },
    }),
  ]);

  const todayFocusSeconds = chartTotals.find((t) => t.date.getTime() === today.getTime())?.focusSeconds ?? 0;

  return {
    timezone,
    today,
    activeSession,
    todayFocusSeconds,
    chartStart,
    chartTotals,
    recentSessions: recentSessions.map((s) => ({ id: s.id, date: s.createdAt, focusSeconds: s.focusSeconds })),
  };
}
