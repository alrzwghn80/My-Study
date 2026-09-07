"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db/client";
import * as timer from "@/server/domain/timer";
import { evaluateRecovery, type RecoveryCheckResult } from "@/server/domain/timer/recovery";
import { requireUserId, toActionError } from "./helpers";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}
function fail<T>(e: unknown): ActionResult<T> {
  return { ok: false, error: toActionError(e) };
}

export async function startSessionAction(categoryId?: string | null): Promise<ActionResult<timer.StartSessionResult>> {
  try {
    const userId = await requireUserId();
    const result = await timer.startSession(prisma, userId, categoryId);
    revalidatePath("/");
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}

export async function pauseSessionAction(sessionId: string, token: string): Promise<ActionResult<{ status: string }>> {
  try {
    const userId = await requireUserId();
    const session = await timer.pauseSession(prisma, userId, sessionId, token);
    revalidatePath("/");
    return ok({ status: session.status });
  } catch (e) {
    return fail(e);
  }
}

export async function resumeSessionAction(sessionId: string, token: string): Promise<ActionResult<{ status: string }>> {
  try {
    const userId = await requireUserId();
    const session = await timer.resumeSession(prisma, userId, sessionId, token);
    revalidatePath("/");
    return ok({ status: session.status });
  } catch (e) {
    return fail(e);
  }
}

export interface CompleteResult {
  sessionId: string;
  focusSeconds: number;
}

export async function completeSessionAction(sessionId: string, token: string): Promise<ActionResult<CompleteResult>> {
  try {
    const userId = await requireUserId();
    const session = await timer.completeSession(prisma, userId, sessionId, token);
    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/analytics");
    return ok({ sessionId: session.id, focusSeconds: session.focusSeconds });
  } catch (e) {
    return fail(e);
  }
}

export async function cancelSessionAction(sessionId: string, token: string): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    await timer.cancelSession(prisma, userId, sessionId, token);
    revalidatePath("/");
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

export async function heartbeatAction(sessionId: string, token: string): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    await timer.recordHeartbeat(prisma, userId, sessionId, token);
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}

export async function claimSessionAction(sessionId: string): Promise<ActionResult<timer.ClaimSessionResult>> {
  try {
    const userId = await requireUserId();
    const result = await timer.claimSession(prisma, userId, sessionId);
    revalidatePath("/");
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}

export interface RecoveryStatus {
  session: NonNullable<Awaited<ReturnType<typeof timer.getActiveSessionForUser>>>;
  recovery: RecoveryCheckResult;
}

/** Called on mount by the client timer to check whether the active session (if any) needs the recovery prompt. */
export async function getRecoveryStatusAction(): Promise<ActionResult<RecoveryStatus | null>> {
  try {
    const userId = await requireUserId();
    const session = await timer.getActiveSessionForUser(prisma, userId);
    if (!session) return ok(null);

    const openInterval = session.intervals[0];
    const recovery = evaluateRecovery({
      now: new Date(),
      lastHeartbeatAt: session.lastHeartbeatAt,
      openIntervalStartedAt: openInterval?.startedAt ?? session.startedAt ?? session.createdAt,
    });
    return ok({ session, recovery });
  } catch (e) {
    return fail(e);
  }
}

export async function recoverResumeAction(sessionId: string, token: string): Promise<ActionResult<{ status: string }>> {
  try {
    const userId = await requireUserId();
    const session = await timer.recoverResumeSession(prisma, userId, sessionId, token);
    revalidatePath("/");
    return ok({ status: session.status });
  } catch (e) {
    return fail(e);
  }
}

export async function recoverEndAction(
  sessionId: string,
  token: string,
  lastKnownGoodAtIso: string,
): Promise<ActionResult<CompleteResult>> {
  try {
    const userId = await requireUserId();
    const session = await timer.recoverEndSession(prisma, userId, sessionId, token, new Date(lastKnownGoodAtIso));
    revalidatePath("/");
    revalidatePath("/history");
    revalidatePath("/analytics");
    return ok({ sessionId: session.id, focusSeconds: session.focusSeconds });
  } catch (e) {
    return fail(e);
  }
}

export interface SaveReviewInput {
  sessionId: string;
  categoryId?: string | null;
  productivityRating?: number | null;
  difficultyRating?: number | null;
  notes?: string | null;
}

export async function saveReviewAction(input: SaveReviewInput): Promise<ActionResult<null>> {
  try {
    const userId = await requireUserId();
    await timer.updateSessionReview(prisma, userId, input.sessionId, {
      categoryId: input.categoryId,
      productivityRating: input.productivityRating,
      difficultyRating: input.difficultyRating,
      notes: input.notes,
    });
    revalidatePath("/");
    revalidatePath("/history");
    return ok(null);
  } catch (e) {
    return fail(e);
  }
}
