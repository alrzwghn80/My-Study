import "server-only";
import { prisma } from "@/server/db/client";
import { SessionStatus } from "@/generated/prisma/enums";
import { addDays, todayInTimezone } from "@/server/domain/calendar";
import { getDailyTotals, type DailyTotal } from "@/server/domain/analytics";

const PAGE_SIZE = 20;
const CHART_DAYS = 30;

export interface HistoryPageData {
  chartStart: Date;
  chartEnd: Date;
  chartTotals: DailyTotal[];
  sessions: {
    id: string;
    date: Date;
    focusSeconds: number;
    source: "TRACKED" | "MANUAL";
  }[];
  page: number;
  hasNextPage: boolean;
}

export async function getHistoryPageData(userId: string, page = 1): Promise<HistoryPageData> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });
  const today = todayInTimezone(settings.timezone);
  const chartStart = addDays(today, -(CHART_DAYS - 1));

  const [chartTotals, sessions] = await Promise.all([
    getDailyTotals(prisma, userId, chartStart, today),
    prisma.studySession.findMany({
      where: { userId, status: SessionStatus.COMPLETED },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
      select: { id: true, createdAt: true, focusSeconds: true, source: true },
    }),
  ]);

  const hasNextPage = sessions.length > PAGE_SIZE;
  const pageSessions = sessions.slice(0, PAGE_SIZE);

  return {
    chartStart,
    chartEnd: today,
    chartTotals,
    sessions: pageSessions.map((s) => ({
      id: s.id,
      date: s.createdAt,
      focusSeconds: s.focusSeconds,
      source: s.source as "TRACKED" | "MANUAL",
    })),
    page,
    hasNextPage,
  };
}
