// Manual time entry (spec §14): stored distinctly (source: MANUAL) from
// tracked sessions, never pretending to be timer-tracked. See
// docs/database.md and docs/timer-state-machine.md.
import type { Prisma, PrismaClient, StudySession } from "@/generated/prisma/client";
import { IntervalType, SessionEventType, SessionSource, SessionStatus } from "@/generated/prisma/enums";
import { todayInTimezone } from "./calendar";
import { zonedTimeToInstant } from "./timezone";
import { SessionNotFoundError } from "./timer/errors";

type Tx = Prisma.TransactionClient;

async function getUserTimezone(tx: Tx, userId: string): Promise<string> {
  const settings = await tx.settings.findUnique({ where: { userId } });
  return settings?.timezone ?? "UTC";
}

async function assertCategoryOwnership(tx: Tx, userId: string, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const category = await tx.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new SessionNotFoundError(categoryId);
}

export interface AddManualTimeInput {
  /** Local calendar date (Y-M-D) this time is attributed to. */
  date: Date;
  durationSeconds: number;
  categoryId?: string | null;
  notes?: string | null;
  productivityRating?: number | null;
  difficultyRating?: number | null;
}

function assertRating(value: number | null | undefined, field: string) {
  if (value === null || value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new RangeError(`${field} must be an integer between 1 and 5`);
  }
}

export async function addManualTime(
  prisma: PrismaClient,
  userId: string,
  input: AddManualTimeInput,
): Promise<StudySession> {
  if (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0) {
    throw new RangeError("Duration must be a positive integer number of seconds");
  }
  assertRating(input.productivityRating, "productivityRating");
  assertRating(input.difficultyRating, "difficultyRating");

  return prisma.$transaction(async (tx) => {
    const timezone = await getUserTimezone(tx, userId);
    const today = todayInTimezone(timezone);
    if (input.date.getTime() > today.getTime()) {
      throw new RangeError("Cannot add manual time for a future date");
    }
    await assertCategoryOwnership(tx, userId, input.categoryId);

    // Anchored at local noon so it never straddles a midnight boundary
    // regardless of timezone — see docs/database.md.
    const startedAt = zonedTimeToInstant(input.date, 12, 0, timezone);
    const completedAt = new Date(startedAt.getTime() + input.durationSeconds * 1000);

    const session = await tx.studySession.create({
      data: {
        userId,
        status: SessionStatus.COMPLETED,
        source: SessionSource.MANUAL,
        categoryId: input.categoryId ?? undefined,
        startedAt,
        completedAt,
        focusSeconds: input.durationSeconds,
        breakSeconds: 0,
        elapsedSeconds: input.durationSeconds,
        notes: input.notes,
        productivityRating: input.productivityRating,
        difficultyRating: input.difficultyRating,
      },
    });

    await tx.sessionEvent.createMany({
      data: [
        { sessionId: session.id, type: SessionEventType.SESSION_CREATED, occurredAt: session.createdAt },
        { sessionId: session.id, type: SessionEventType.MANUAL_TIME_ADDED, occurredAt: session.createdAt },
      ],
    });

    await tx.sessionInterval.create({
      data: {
        sessionId: session.id,
        userId,
        type: IntervalType.FOCUS,
        startedAt,
        endedAt: completedAt,
        durationSeconds: input.durationSeconds,
        localDate: input.date,
      },
    });

    return session;
  });
}

export type EditManualTimeInput = Partial<AddManualTimeInput>;

/** Edits a manual entry. Rebuilds its interval from scratch so totals stay exact. */
export async function editManualTime(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  input: EditManualTimeInput,
): Promise<StudySession> {
  if (input.durationSeconds !== undefined && (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0)) {
    throw new RangeError("Duration must be a positive integer number of seconds");
  }
  assertRating(input.productivityRating, "productivityRating");
  assertRating(input.difficultyRating, "difficultyRating");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.studySession.findFirst({ where: { id: sessionId, userId, source: SessionSource.MANUAL } });
    if (!existing) throw new SessionNotFoundError(sessionId);

    const timezone = await getUserTimezone(tx, userId);
    const today = todayInTimezone(timezone);

    const existingInterval = await tx.sessionInterval.findFirstOrThrow({ where: { sessionId } });
    const date = input.date ?? existingInterval.localDate;
    if (date.getTime() > today.getTime()) {
      throw new RangeError("Cannot set manual time for a future date");
    }
    if (input.categoryId !== undefined) await assertCategoryOwnership(tx, userId, input.categoryId);

    const durationSeconds = input.durationSeconds ?? existingInterval.durationSeconds ?? 0;
    const startedAt = zonedTimeToInstant(date, 12, 0, timezone);
    const completedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

    await tx.sessionInterval.deleteMany({ where: { sessionId } });
    await tx.sessionInterval.create({
      data: {
        sessionId,
        userId,
        type: IntervalType.FOCUS,
        startedAt,
        endedAt: completedAt,
        durationSeconds,
        localDate: date,
      },
    });

    return tx.studySession.update({
      where: { id: sessionId },
      data: {
        startedAt,
        completedAt,
        focusSeconds: durationSeconds,
        elapsedSeconds: durationSeconds,
        categoryId: input.categoryId !== undefined ? input.categoryId : undefined,
        notes: input.notes !== undefined ? input.notes : undefined,
        productivityRating: input.productivityRating !== undefined ? input.productivityRating : undefined,
        difficultyRating: input.difficultyRating !== undefined ? input.difficultyRating : undefined,
      },
    });
  });
}

/** Deletes a manual entry outright (cascades to its interval/events). Tracked sessions are never deleted this way. */
export async function deleteManualTime(prisma: PrismaClient, userId: string, sessionId: string): Promise<void> {
  const existing = await prisma.studySession.findFirst({ where: { id: sessionId, userId, source: SessionSource.MANUAL } });
  if (!existing) throw new SessionNotFoundError(sessionId);
  await prisma.studySession.delete({ where: { id: sessionId } });
}
