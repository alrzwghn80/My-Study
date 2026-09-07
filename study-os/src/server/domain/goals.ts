// Goal versioning (docs/database.md §Goal versioning): a new Goal row is
// inserted whenever a target changes; evaluating a past day always uses the
// row with the latest effectiveFrom <= that day, so raising today's target
// never rewrites whether yesterday counted as "on track."
import type { PrismaClient } from "@/generated/prisma/client";
import { GoalLevel, GoalPeriod } from "@/generated/prisma/enums";

export interface GoalSet {
  minimum: number | null;
  target: number | null;
  stretch: number | null;
}

/** The MINIMUM/TARGET/STRETCH seconds in effect for `period` as of `date`. */
export async function getEffectiveGoals(
  prisma: PrismaClient,
  userId: string,
  period: GoalPeriod,
  date: Date,
): Promise<GoalSet> {
  const rows = await prisma.goal.findMany({
    where: { userId, period, effectiveFrom: { lte: date } },
    orderBy: { effectiveFrom: "desc" },
  });

  const result: GoalSet = { minimum: null, target: null, stretch: null };
  const seen = new Set<GoalLevel>();
  for (const row of rows) {
    if (seen.has(row.level)) continue;
    seen.add(row.level);
    if (row.level === GoalLevel.MINIMUM) result.minimum = row.seconds;
    if (row.level === GoalLevel.TARGET) result.target = row.seconds;
    if (row.level === GoalLevel.STRETCH) result.stretch = row.seconds;
    if (seen.size === 3) break;
  }
  return result;
}

/** Sets a new effective goal value starting today — inserts a new version, never mutates history. */
export async function setGoal(
  prisma: PrismaClient,
  userId: string,
  period: GoalPeriod,
  level: GoalLevel,
  seconds: number,
  effectiveFrom: Date,
) {
  if (!Number.isInteger(seconds) || seconds <= 0) {
    throw new RangeError("Goal seconds must be a positive integer");
  }
  return prisma.goal.upsert({
    where: { userId_period_level_effectiveFrom: { userId, period, level, effectiveFrom } },
    update: { seconds },
    create: { userId, period, level, seconds, effectiveFrom },
  });
}

export interface GoalCompletion {
  minimum: boolean;
  target: boolean;
  stretch: boolean;
}

export function evaluateGoalCompletion(actualSeconds: number, goals: GoalSet): GoalCompletion {
  return {
    minimum: goals.minimum !== null && actualSeconds >= goals.minimum,
    target: goals.target !== null && actualSeconds >= goals.target,
    stretch: goals.stretch !== null && actualSeconds >= goals.stretch,
  };
}

// ── Long-term goal ────────────────────────────────────────────────────────

export interface LongTermGoalProgress {
  id: string;
  title: string;
  targetSeconds: number;
  targetDate: Date | null;
  startDate: Date;
  completedSeconds: number;
  progress: number; // 0..1
  requiredDailyPaceSeconds: number | null; // only if targetDate set
  estimatedCompletionDate: Date | null; // based on actual historical pace
}

export function computeLongTermGoalProgress(params: {
  id: string;
  title: string;
  targetSeconds: number;
  targetDate: Date | null;
  startDate: Date;
  completedSeconds: number;
  today: Date;
}): LongTermGoalProgress {
  const { id, title, targetSeconds, targetDate, startDate, completedSeconds, today } = params;
  const progress = targetSeconds === 0 ? 0 : Math.min(1, completedSeconds / targetSeconds);

  let requiredDailyPaceSeconds: number | null = null;
  if (targetDate) {
    const daysRemaining = Math.max(1, Math.round((targetDate.getTime() - today.getTime()) / 86_400_000));
    requiredDailyPaceSeconds = Math.max(0, (targetSeconds - completedSeconds) / daysRemaining);
  }

  const daysElapsed = Math.max(1, Math.round((today.getTime() - startDate.getTime()) / 86_400_000));
  const averageDailyPace = completedSeconds / daysElapsed;
  let estimatedCompletionDate: Date | null = null;
  if (averageDailyPace > 0 && completedSeconds < targetSeconds) {
    const daysNeeded = Math.ceil((targetSeconds - completedSeconds) / averageDailyPace);
    estimatedCompletionDate = new Date(today.getTime() + daysNeeded * 86_400_000);
  } else if (completedSeconds >= targetSeconds) {
    estimatedCompletionDate = today;
  }

  return {
    id,
    title,
    targetSeconds,
    targetDate,
    startDate,
    completedSeconds,
    progress,
    requiredDailyPaceSeconds,
    estimatedCompletionDate,
  };
}
