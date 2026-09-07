"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import { addManualTime, deleteManualTime, editManualTime } from "@/server/domain/manual-entry";
import { requireUserId, toActionError } from "./helpers";
import type { ActionResult } from "./timer";

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
function fail<T>(e: unknown): ActionResult<T> {
  return { ok: false, error: toActionError(e) };
}

export interface ManualTimeFormInput {
  date: string; // "YYYY-MM-DD"
  durationMinutes: number;
  categoryId?: string | null;
  notes?: string | null;
  productivityRating?: number | null;
  difficultyRating?: number | null;
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) throw new RangeError("Invalid date");
  return new Date(Date.UTC(y, m - 1, d));
}

export async function addManualTimeAction(input: ManualTimeFormInput): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const userId = await requireUserId();
    if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
      throw new RangeError("Duration must be greater than zero");
    }
    const session = await addManualTime(prisma, userId, {
      date: parseDate(input.date),
      durationSeconds: Math.round(input.durationMinutes * 60),
      categoryId: input.categoryId,
      notes: input.notes,
      productivityRating: input.productivityRating,
      difficultyRating: input.difficultyRating,
    });
    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/analytics");
    return ok({ sessionId: session.id });
  } catch (e) {
    return fail(e);
  }
}

export async function editManualTimeAction(
  sessionId: string,
  input: Partial<ManualTimeFormInput>,
): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    await editManualTime(prisma, userId, sessionId, {
      date: input.date ? parseDate(input.date) : undefined,
      durationSeconds: input.durationMinutes !== undefined ? Math.round(input.durationMinutes * 60) : undefined,
      categoryId: input.categoryId,
      notes: input.notes,
      productivityRating: input.productivityRating,
      difficultyRating: input.difficultyRating,
    });
    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/analytics");
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

export async function deleteManualTimeAction(sessionId: string): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    await deleteManualTime(prisma, userId, sessionId);
    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/analytics");
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}
