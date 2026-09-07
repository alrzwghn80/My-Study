"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { GoalLevel, GoalPeriod } from "@/generated/prisma/enums";
import { setGoal } from "@/server/domain/goals";
import { todayInTimezone } from "@/server/domain/calendar";
import { requireUserId, toActionError } from "./helpers";
import type { ActionResult } from "./timer";

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
function fail<T>(e: unknown): ActionResult<T> {
  return { ok: false, error: toActionError(e) };
}

async function getUserTimezone(userId: string): Promise<string> {
  const settings = await prisma.settings.findUnique({ where: { userId } });
  return settings?.timezone ?? "UTC";
}

export interface SetGoalsInput {
  period: GoalPeriod;
  minimumMinutes?: number | null;
  targetMinutes?: number | null;
  stretchMinutes?: number | null;
}

/** Sets minimum/target/stretch together, effective from today, per docs/database.md §Goal versioning. */
export async function setGoalsAction(input: SetGoalsInput): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    const timezone = await getUserTimezone(userId);
    const today = todayInTimezone(timezone);

    const levels: [GoalLevel, number | null | undefined][] = [
      [GoalLevel.MINIMUM, input.minimumMinutes],
      [GoalLevel.TARGET, input.targetMinutes],
      [GoalLevel.STRETCH, input.stretchMinutes],
    ];
    for (const [level, minutes] of levels) {
      if (minutes === null || minutes === undefined) continue;
      await setGoal(prisma, userId, input.period, level, Math.round(minutes * 60), today);
    }
    revalidatePath("/");
    revalidatePath("/goals");
    revalidatePath("/analytics");
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

export interface LongTermGoalInput {
  title: string;
  targetHours: number;
  targetDate?: string | null; // "YYYY-MM-DD"
  startDate: string; // "YYYY-MM-DD"
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) throw new RangeError("Invalid date");
  return new Date(Date.UTC(y, m - 1, d));
}

export async function createLongTermGoalAction(input: LongTermGoalInput): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = await requireUserId();
    const title = input.title.trim();
    if (!title) throw new RangeError("Title is required");
    if (!Number.isFinite(input.targetHours) || input.targetHours <= 0) {
      throw new RangeError("Target hours must be greater than zero");
    }
    const goal = await prisma.longTermGoal.create({
      data: {
        userId,
        title,
        targetSeconds: Math.round(input.targetHours * 3600),
        targetDate: input.targetDate ? parseDate(input.targetDate) : null,
        startDate: parseDate(input.startDate),
        isActive: true,
      },
    });
    revalidatePath("/goals");
    revalidatePath("/");
    return ok({ id: goal.id });
  } catch (e) {
    return fail(e);
  }
}

export async function archiveLongTermGoalAction(goalId: string): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    const existing = await prisma.longTermGoal.findFirst({ where: { id: goalId, userId } });
    if (!existing) throw new Error("Goal not found");
    await prisma.longTermGoal.update({ where: { id: goalId }, data: { isActive: false } });
    revalidatePath("/goals");
    revalidatePath("/");
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}
