"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { requireUserId, toActionError } from "./helpers";
import type { ActionResult } from "./timer";

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
function fail<T>(e: unknown): ActionResult<T> {
  return { ok: false, error: toActionError(e) };
}

export interface UpdateSettingsInput {
  timezone?: string;
  streakThresholdMinutes?: number;
  theme?: "light" | "dark" | "system";
  reducedMotion?: boolean;
  notificationsEnabled?: boolean;
  soundEnabled?: boolean;
  autoStartBreakOnPause?: boolean;
}

export async function updateSettingsAction(input: UpdateSettingsInput): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();

    if (input.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
      } catch {
        throw new RangeError("Unrecognized timezone");
      }
    }
    if (input.streakThresholdMinutes !== undefined && input.streakThresholdMinutes <= 0) {
      throw new RangeError("Streak threshold must be greater than zero");
    }

    await prisma.settings.update({
      where: { userId },
      data: {
        timezone: input.timezone,
        streakThresholdSeconds:
          input.streakThresholdMinutes !== undefined ? Math.round(input.streakThresholdMinutes * 60) : undefined,
        theme: input.theme,
        reducedMotion: input.reducedMotion,
        notificationsEnabled: input.notificationsEnabled,
        soundEnabled: input.soundEnabled,
        autoStartBreakOnPause: input.autoStartBreakOnPause,
      },
    });

    revalidatePath("/", "layout");
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}
