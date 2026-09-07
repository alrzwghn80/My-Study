import "server-only";
import { prisma } from "@/server/db/client";
import type { Prisma } from "@/generated/prisma/client";
import { SessionSource, SessionStatus } from "@/generated/prisma/enums";

export interface HistoryFilters {
  dateFrom?: Date;
  dateTo?: Date;
  categoryId?: string;
  source?: "TRACKED" | "MANUAL";
  status?: "COMPLETED" | "CANCELLED";
  minDurationMinutes?: number;
  search?: string;
  page?: number;
}

const PAGE_SIZE = 25;

export async function getSessionHistory(userId: string, filters: HistoryFilters) {
  const where: Prisma.StudySessionWhereInput = { userId };

  if (filters.source) where.source = filters.source as SessionSource;
  if (filters.status) where.status = filters.status as SessionStatus;
  else where.status = { in: [SessionStatus.COMPLETED, SessionStatus.CANCELLED] }; // never show ACTIVE/PAUSED in history
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.minDurationMinutes) where.focusSeconds = { gte: Math.round(filters.minDurationMinutes * 60) };
  if (filters.search) where.notes = { contains: filters.search, mode: "insensitive" };
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: new Date(filters.dateTo.getTime() + 86_400_000) } : {}),
    };
  }

  const page = filters.page ?? 1;

  const [sessions, total] = await Promise.all([
    prisma.studySession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { name: true, color: true } } },
    }),
    prisma.studySession.count({ where }),
  ]);

  return { sessions, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getDayDetail(userId: string, date: Date) {
  const [intervals, sessions] = await Promise.all([
    prisma.sessionInterval.findMany({
      where: { userId, localDate: date },
      orderBy: { startedAt: "asc" },
    }),
    prisma.studySession.findMany({
      where: {
        userId,
        intervals: { some: { localDate: date } },
      },
      include: { category: { select: { name: true, color: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const focusSeconds = intervals.filter((i) => i.type === "FOCUS").reduce((s, i) => s + (i.durationSeconds ?? 0), 0);
  const breakSeconds = intervals.filter((i) => i.type === "BREAK").reduce((s, i) => s + (i.durationSeconds ?? 0), 0);

  return { intervals, sessions, focusSeconds, breakSeconds };
}
