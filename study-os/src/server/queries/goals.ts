import "server-only";
import { prisma } from "@/server/db/client";
import { GoalPeriod, IntervalType } from "@/generated/prisma/enums";
import { getEffectiveGoals, computeLongTermGoalProgress, type LongTermGoalProgress } from "@/server/domain/goals";
import { todayInTimezone } from "@/server/domain/calendar";

export interface GoalsPageData {
  today: Date;
  daily: Awaited<ReturnType<typeof getEffectiveGoals>>;
  weekly: Awaited<ReturnType<typeof getEffectiveGoals>>;
  monthly: Awaited<ReturnType<typeof getEffectiveGoals>>;
  longTermGoals: LongTermGoalProgress[];
}

export async function getGoalsPageData(userId: string): Promise<GoalsPageData> {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });
  const today = todayInTimezone(settings.timezone);

  const [daily, weekly, monthly, activeLongTermGoals] = await Promise.all([
    getEffectiveGoals(prisma, userId, GoalPeriod.DAILY, today),
    getEffectiveGoals(prisma, userId, GoalPeriod.WEEKLY, today),
    getEffectiveGoals(prisma, userId, GoalPeriod.MONTHLY, today),
    prisma.longTermGoal.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const longTermGoals: LongTermGoalProgress[] = [];
  for (const goal of activeLongTermGoals) {
    const completedAgg = await prisma.sessionInterval.aggregate({
      where: { userId, type: IntervalType.FOCUS, localDate: { gte: goal.startDate } },
      _sum: { durationSeconds: true },
    });
    longTermGoals.push(
      computeLongTermGoalProgress({
        id: goal.id,
        title: goal.title,
        targetSeconds: goal.targetSeconds,
        targetDate: goal.targetDate,
        startDate: goal.startDate,
        completedSeconds: completedAgg._sum.durationSeconds ?? 0,
        today,
      }),
    );
  }

  return { today, daily, weekly, monthly, longTermGoals };
}
