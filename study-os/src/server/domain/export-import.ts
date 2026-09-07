// Backup export/import (spec §41/§42). Export is a complete, literal dump;
// import is validated with zod and is always ADDITIVE — it never deletes or
// overwrites existing rows, only inserts (categories and goals are matched
// by their natural key and upserted so re-importing the same backup twice
// doesn't duplicate them; sessions and long-term goals always insert as new
// rows since they have no natural dedup key). This is the safer default for
// a "restore my backup" feature: it can never silently destroy data already
// in the database, at the cost of the caller needing to remove duplicates
// by hand if they import the same backup file twice.
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  GoalLevel,
  GoalPeriod,
  IntervalType,
  SessionEventType,
  SessionSource,
  SessionStatus,
} from "@/generated/prisma/enums";

const EXPORT_VERSION = 1;

const categorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string(),
  isArchived: z.boolean(),
  sortOrder: z.number().int(),
});

const eventSchema = z.object({
  type: z.enum(SessionEventType),
  occurredAt: z.string(),
  clientTimestamp: z.string().nullable().optional(),
  metadata: z.unknown().nullable().optional(),
});

const intervalSchema = z.object({
  type: z.enum(IntervalType),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationSeconds: z.number().int().nullable(),
  localDate: z.string(),
});

const sessionSchema = z.object({
  id: z.string(),
  status: z.enum(SessionStatus),
  source: z.enum(SessionSource),
  categoryId: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  focusSeconds: z.number().int(),
  breakSeconds: z.number().int(),
  elapsedSeconds: z.number().int(),
  productivityRating: z.number().int().min(1).max(5).nullable(),
  difficultyRating: z.number().int().min(1).max(5).nullable(),
  notes: z.string().nullable(),
  events: z.array(eventSchema),
  intervals: z.array(intervalSchema),
});

const goalSchema = z.object({
  period: z.enum(GoalPeriod),
  level: z.enum(GoalLevel),
  seconds: z.number().int().positive(),
  effectiveFrom: z.string(),
});

const longTermGoalSchema = z.object({
  title: z.string().min(1),
  targetSeconds: z.number().int().positive(),
  targetDate: z.string().nullable(),
  startDate: z.string(),
  isActive: z.boolean(),
});

const achievementSchema = z.object({
  type: z.string().min(1),
  unlockedAt: z.string(),
  value: z.number().int(),
});

const settingsSchema = z.object({
  timezone: z.string(),
  streakThresholdSeconds: z.number().int().positive(),
  theme: z.string(),
  reducedMotion: z.boolean(),
  notificationsEnabled: z.boolean(),
  soundEnabled: z.boolean(),
  autoStartBreakOnPause: z.boolean(),
});

export const backupSchema = z.object({
  version: z.number().int(),
  exportedAt: z.string(),
  settings: settingsSchema,
  categories: z.array(categorySchema),
  sessions: z.array(sessionSchema),
  goals: z.array(goalSchema),
  longTermGoals: z.array(longTermGoalSchema),
  achievements: z.array(achievementSchema),
});

export type Backup = z.infer<typeof backupSchema>;

export async function exportUserData(prisma: PrismaClient, userId: string): Promise<Backup> {
  const [settings, categories, sessions, goals, longTermGoals, achievements] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.category.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
    prisma.studySession.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: { events: { orderBy: { occurredAt: "asc" } }, intervals: { orderBy: { startedAt: "asc" } } },
    }),
    prisma.goal.findMany({ where: { userId } }),
    prisma.longTermGoal.findMany({ where: { userId } }),
    prisma.achievement.findMany({ where: { userId } }),
  ]);

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      timezone: settings.timezone,
      streakThresholdSeconds: settings.streakThresholdSeconds,
      theme: settings.theme,
      reducedMotion: settings.reducedMotion,
      notificationsEnabled: settings.notificationsEnabled,
      soundEnabled: settings.soundEnabled,
      autoStartBreakOnPause: settings.autoStartBreakOnPause,
    },
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      isArchived: c.isArchived,
      sortOrder: c.sortOrder,
    })),
    sessions: sessions.map((s) => ({
      id: s.id,
      status: s.status,
      source: s.source,
      categoryId: s.categoryId,
      startedAt: s.startedAt?.toISOString() ?? null,
      completedAt: s.completedAt?.toISOString() ?? null,
      focusSeconds: s.focusSeconds,
      breakSeconds: s.breakSeconds,
      elapsedSeconds: s.elapsedSeconds,
      productivityRating: s.productivityRating,
      difficultyRating: s.difficultyRating,
      notes: s.notes,
      events: s.events.map((e) => ({
        type: e.type,
        occurredAt: e.occurredAt.toISOString(),
        clientTimestamp: e.clientTimestamp?.toISOString() ?? null,
        metadata: e.metadata,
      })),
      intervals: s.intervals.map((iv) => ({
        type: iv.type,
        startedAt: iv.startedAt.toISOString(),
        endedAt: iv.endedAt?.toISOString() ?? null,
        durationSeconds: iv.durationSeconds,
        localDate: iv.localDate.toISOString(),
      })),
    })),
    goals: goals.map((g) => ({
      period: g.period,
      level: g.level,
      seconds: g.seconds,
      effectiveFrom: g.effectiveFrom.toISOString(),
    })),
    longTermGoals: longTermGoals.map((g) => ({
      title: g.title,
      targetSeconds: g.targetSeconds,
      targetDate: g.targetDate?.toISOString() ?? null,
      startDate: g.startDate.toISOString(),
      isActive: g.isActive,
    })),
    achievements: achievements.map((a) => ({
      type: a.type,
      unlockedAt: a.unlockedAt.toISOString(),
      value: a.value,
    })),
  };
}

export interface ImportSummary {
  categoriesCreated: number;
  categoriesMatched: number;
  sessionsImported: number;
  goalsUpserted: number;
  longTermGoalsImported: number;
  achievementsUpserted: number;
}

export async function importUserData(prisma: PrismaClient, userId: string, raw: unknown): Promise<ImportSummary> {
  const backup = backupSchema.parse(raw); // throws ZodError on malformed input — never inserted

  return prisma.$transaction(async (tx) => {
    const categoryIdMap = new Map<string, string>();
    let categoriesCreated = 0;
    let categoriesMatched = 0;

    for (const c of backup.categories) {
      const existing = await tx.category.findUnique({ where: { userId_name: { userId, name: c.name } } });
      if (existing) {
        categoryIdMap.set(c.id, existing.id);
        categoriesMatched++;
      } else {
        const created = await tx.category.create({
          data: { userId, name: c.name, color: c.color, isArchived: c.isArchived, sortOrder: c.sortOrder },
        });
        categoryIdMap.set(c.id, created.id);
        categoriesCreated++;
      }
    }

    let sessionsImported = 0;
    for (const s of backup.sessions) {
      const newCategoryId = s.categoryId ? categoryIdMap.get(s.categoryId) : null;
      const session = await tx.studySession.create({
        data: {
          userId,
          status: s.status,
          source: s.source,
          categoryId: newCategoryId,
          startedAt: s.startedAt ? new Date(s.startedAt) : null,
          completedAt: s.completedAt ? new Date(s.completedAt) : null,
          focusSeconds: s.focusSeconds,
          breakSeconds: s.breakSeconds,
          elapsedSeconds: s.elapsedSeconds,
          productivityRating: s.productivityRating,
          difficultyRating: s.difficultyRating,
          notes: s.notes,
        },
      });

      if (s.events.length > 0) {
        await tx.sessionEvent.createMany({
          data: s.events.map((e) => ({
            sessionId: session.id,
            type: e.type,
            occurredAt: new Date(e.occurredAt),
            clientTimestamp: e.clientTimestamp ? new Date(e.clientTimestamp) : null,
            metadata: e.metadata ?? undefined,
          })),
        });
      }
      if (s.intervals.length > 0) {
        await tx.sessionInterval.createMany({
          data: s.intervals.map((iv) => ({
            sessionId: session.id,
            userId,
            type: iv.type,
            startedAt: new Date(iv.startedAt),
            endedAt: iv.endedAt ? new Date(iv.endedAt) : null,
            durationSeconds: iv.durationSeconds,
            localDate: new Date(iv.localDate),
          })),
        });
      }
      sessionsImported++;
    }

    let goalsUpserted = 0;
    for (const g of backup.goals) {
      await tx.goal.upsert({
        where: {
          userId_period_level_effectiveFrom: {
            userId,
            period: g.period,
            level: g.level,
            effectiveFrom: new Date(g.effectiveFrom),
          },
        },
        update: { seconds: g.seconds },
        create: { userId, period: g.period, level: g.level, seconds: g.seconds, effectiveFrom: new Date(g.effectiveFrom) },
      });
      goalsUpserted++;
    }

    for (const g of backup.longTermGoals) {
      await tx.longTermGoal.create({
        data: {
          userId,
          title: g.title,
          targetSeconds: g.targetSeconds,
          targetDate: g.targetDate ? new Date(g.targetDate) : null,
          startDate: new Date(g.startDate),
          isActive: g.isActive,
        },
      });
    }

    let achievementsUpserted = 0;
    for (const a of backup.achievements) {
      await tx.achievement.upsert({
        where: { userId_type: { userId, type: a.type } },
        update: { unlockedAt: new Date(a.unlockedAt), value: a.value },
        create: { userId, type: a.type, unlockedAt: new Date(a.unlockedAt), value: a.value },
      });
      achievementsUpserted++;
    }

    return {
      categoriesCreated,
      categoriesMatched,
      sessionsImported,
      goalsUpserted,
      longTermGoalsImported: backup.longTermGoals.length,
      achievementsUpserted,
    };
  });
}

export function toCsv(sessions: Awaited<ReturnType<typeof exportUserData>>["sessions"], categoryNameById: Map<string, string>): string {
  const header = [
    "date",
    "category",
    "source",
    "status",
    "focusSeconds",
    "breakSeconds",
    "productivityRating",
    "difficultyRating",
    "notes",
  ];
  const rows = sessions.map((s) => {
    const date = s.intervals[0]?.localDate?.slice(0, 10) ?? s.startedAt?.slice(0, 10) ?? "";
    const category = s.categoryId ? (categoryNameById.get(s.categoryId) ?? "") : "";
    const notes = (s.notes ?? "").replaceAll('"', '""');
    return [
      date,
      category,
      s.source,
      s.status,
      String(s.focusSeconds),
      String(s.breakSeconds),
      s.productivityRating != null ? String(s.productivityRating) : "",
      s.difficultyRating != null ? String(s.difficultyRating) : "",
      `"${notes}"`,
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}
