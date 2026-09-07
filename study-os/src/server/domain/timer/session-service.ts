import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma, StudySession } from "@/generated/prisma/client";
import { IntervalType, SessionEventType, SessionSource, SessionStatus } from "@/generated/prisma/enums";
import { localCalendarDate, splitIntervalAtLocalMidnight } from "@/server/domain/timezone";
import { nextStatus } from "./transitions";
import {
  SessionAlreadyActiveError,
  SessionNotFoundError,
  StaleControlTokenError,
} from "./errors";

type Tx = Prisma.TransactionClient;

// ── Internal helpers ─────────────────────────────────────────────────────

async function getUserTimezone(tx: Tx, userId: string): Promise<string> {
  const settings = await tx.settings.findUnique({ where: { userId } });
  return settings?.timezone ?? "UTC";
}

async function loadOwnedSession(tx: Tx, userId: string, sessionId: string): Promise<StudySession> {
  const session = await tx.studySession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new SessionNotFoundError(sessionId);
  return session;
}

function assertToken(session: { activeToken: string | null }, token: string, sessionId: string) {
  if (!session.activeToken || session.activeToken !== token) {
    throw new StaleControlTokenError(sessionId);
  }
}

function assertRating(value: number | null | undefined, field: string) {
  if (value === null || value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new RangeError(`${field} must be an integer between 1 and 5`);
  }
}

async function assertCategoryOwnership(tx: Tx, userId: string, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const category = await tx.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new SessionNotFoundError(categoryId); // reused: "referenced row not found for this user"
}

/**
 * Closes the session's single open interval (if any) at `endedAt`, splitting
 * it at local-midnight boundaries per docs/database.md. Returns the total
 * seconds added across the resulting piece(s), 0 if there was no open
 * interval or the gap was non-positive (immediate pause/resume — spec §64).
 */
async function closeOpenInterval(
  tx: Tx,
  sessionId: string,
  userId: string,
  timezone: string,
  endedAt: Date,
): Promise<number> {
  const open = await tx.sessionInterval.findFirst({ where: { sessionId, endedAt: null } });
  if (!open) return 0;

  await tx.sessionInterval.delete({ where: { id: open.id } });
  if (endedAt.getTime() <= open.startedAt.getTime()) return 0;

  const pieces = splitIntervalAtLocalMidnight(open.startedAt, endedAt, timezone);
  await tx.sessionInterval.createMany({
    data: pieces.map((p) => ({
      sessionId,
      userId,
      type: open.type,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
      durationSeconds: p.durationSeconds,
      localDate: p.localDate,
    })),
  });
  return pieces.reduce((sum, p) => sum + p.durationSeconds, 0);
}

async function openInterval(
  tx: Tx,
  sessionId: string,
  userId: string,
  type: IntervalType,
  startedAt: Date,
  timezone: string,
) {
  await tx.sessionInterval.create({
    data: {
      sessionId,
      userId,
      type,
      startedAt,
      endedAt: null,
      durationSeconds: null,
      localDate: localCalendarDate(startedAt, timezone),
    },
  });
}

// ── Public operations ────────────────────────────────────────────────────

export interface StartSessionResult {
  sessionId: string;
  activeToken: string;
}

/** IDLE --Start--> RUNNING. See docs/timer-state-machine.md. */
export async function startSession(
  prisma: PrismaClient,
  userId: string,
  categoryId?: string | null,
): Promise<StartSessionResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.studySession.findFirst({
        where: { userId, status: { in: [SessionStatus.ACTIVE, SessionStatus.PAUSED] } },
      });
      if (existing) throw new SessionAlreadyActiveError(existing.id);

      await assertCategoryOwnership(tx, userId, categoryId);
      const timezone = await getUserTimezone(tx, userId);
      const now = new Date();
      const activeToken = randomUUID();

      const session = await tx.studySession.create({
        data: {
          userId,
          status: SessionStatus.ACTIVE,
          source: SessionSource.TRACKED,
          categoryId: categoryId ?? undefined,
          startedAt: now,
          activeToken,
          lastHeartbeatAt: now,
        },
      });

      await tx.sessionEvent.createMany({
        data: [
          { sessionId: session.id, type: SessionEventType.SESSION_CREATED, occurredAt: now },
          { sessionId: session.id, type: SessionEventType.SESSION_STARTED, occurredAt: now },
        ],
      });

      await openInterval(tx, session.id, userId, IntervalType.FOCUS, now, timezone);

      return { sessionId: session.id, activeToken };
    });
  } catch (e) {
    // Backstop for the race two concurrent starts can create: the app-level
    // check above and the DB's partial unique index (see prisma/migrations)
    // both guard this, but only the index is race-proof.
    if (isUniqueConstraintViolation(e)) {
      const existing = await prisma.studySession.findFirst({
        where: { userId, status: { in: [SessionStatus.ACTIVE, SessionStatus.PAUSED] } },
      });
      throw new SessionAlreadyActiveError(existing?.id ?? "unknown");
    }
    throw e;
  }
}

function isUniqueConstraintViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}

/** RUNNING --Pause--> PAUSED. Same session id, per docs/timer-state-machine.md. */
export async function pauseSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  token: string,
): Promise<StudySession> {
  return prisma.$transaction(async (tx) => {
    const session = await loadOwnedSession(tx, userId, sessionId);
    nextStatus(session.status, "PAUSE");
    assertToken(session, token, sessionId);

    const timezone = await getUserTimezone(tx, userId);
    const now = new Date();
    const addedFocusSeconds = await closeOpenInterval(tx, sessionId, userId, timezone, now);
    await openInterval(tx, sessionId, userId, IntervalType.BREAK, now, timezone);
    await tx.sessionEvent.create({
      data: { sessionId, type: SessionEventType.SESSION_PAUSED, occurredAt: now },
    });

    return tx.studySession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.PAUSED,
        focusSeconds: { increment: addedFocusSeconds },
        elapsedSeconds: { increment: addedFocusSeconds },
        lastHeartbeatAt: now,
      },
    });
  });
}

/** PAUSED --Resume--> RUNNING. Same session id. */
export async function resumeSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  token: string,
): Promise<StudySession> {
  return prisma.$transaction(async (tx) => {
    const session = await loadOwnedSession(tx, userId, sessionId);
    nextStatus(session.status, "RESUME");
    assertToken(session, token, sessionId);

    const timezone = await getUserTimezone(tx, userId);
    const now = new Date();
    const addedBreakSeconds = await closeOpenInterval(tx, sessionId, userId, timezone, now);
    await openInterval(tx, sessionId, userId, IntervalType.FOCUS, now, timezone);
    await tx.sessionEvent.create({
      data: { sessionId, type: SessionEventType.SESSION_RESUMED, occurredAt: now },
    });

    return tx.studySession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.ACTIVE,
        breakSeconds: { increment: addedBreakSeconds },
        elapsedSeconds: { increment: addedBreakSeconds },
        lastHeartbeatAt: now,
      },
    });
  });
}

export interface CompleteSessionOptions {
  /** Overrides `now` as the close timestamp — used by the recovery "End Session" flow. */
  endAt?: Date;
  /** Marks the completion as coming through session recovery (emits SESSION_RECOVERED first). */
  recovered?: boolean;
}

/**
 * RUNNING|PAUSED --Complete--> COMPLETED. Keeps whatever focus time was
 * accrued, even if short — this is the counterpart to Cancel discarding
 * everything. See docs/timer-state-machine.md §Decision: Cancel discards
 * the whole session.
 */
export async function completeSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  token: string,
  options: CompleteSessionOptions = {},
): Promise<StudySession> {
  return prisma.$transaction(async (tx) => {
    const session = await loadOwnedSession(tx, userId, sessionId);
    nextStatus(session.status, "COMPLETE");
    assertToken(session, token, sessionId);

    const timezone = await getUserTimezone(tx, userId);
    // `recordedAt` is when this transition is actually being persisted — what
    // every event's occurredAt means everywhere else. `endAt` is the (possibly
    // backdated, for recovery) instant the session's content actually ends —
    // it drives the interval boundary and completedAt, never the event log's
    // own timestamps, so recovered events still read in true chronological
    // order (SESSION_RECOVERED then SESSION_COMPLETED, both "now").
    const recordedAt = new Date();
    const endAt = options.endAt ?? recordedAt;
    const wasFocusOpen = session.status === SessionStatus.ACTIVE;
    const addedSeconds = await closeOpenInterval(tx, sessionId, userId, timezone, endAt);

    if (options.recovered) {
      await tx.sessionEvent.create({
        data: {
          sessionId,
          type: SessionEventType.SESSION_RECOVERED,
          occurredAt: recordedAt,
          metadata: { closedAt: endAt.toISOString(), action: "end" },
        },
      });
    }
    await tx.sessionEvent.create({
      data: { sessionId, type: SessionEventType.SESSION_COMPLETED, occurredAt: recordedAt },
    });

    return tx.studySession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        completedAt: endAt,
        activeToken: null,
        ...(wasFocusOpen
          ? { focusSeconds: { increment: addedSeconds }, elapsedSeconds: { increment: addedSeconds } }
          : { breakSeconds: { increment: addedSeconds }, elapsedSeconds: { increment: addedSeconds } }),
      },
    });
  });
}

/**
 * RUNNING|PAUSED --Cancel--> CANCELLED. Discards every interval outright —
 * counts toward nothing. See docs/timer-state-machine.md.
 */
export async function cancelSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  token: string,
): Promise<StudySession> {
  return prisma.$transaction(async (tx) => {
    const session = await loadOwnedSession(tx, userId, sessionId);
    nextStatus(session.status, "CANCEL");
    assertToken(session, token, sessionId);

    const now = new Date();
    await tx.sessionInterval.deleteMany({ where: { sessionId } });
    await tx.sessionEvent.create({
      data: { sessionId, type: SessionEventType.SESSION_CANCELLED, occurredAt: now },
    });

    return tx.studySession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.CANCELLED,
        completedAt: now,
        activeToken: null,
        focusSeconds: 0,
        breakSeconds: 0,
        elapsedSeconds: 0,
      },
    });
  });
}

/** Updates StudySession.lastHeartbeatAt — see docs/architecture.md §Timer architecture. */
export async function recordHeartbeat(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  token: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const session = await loadOwnedSession(tx, userId, sessionId);
    assertToken(session, token, sessionId);
    if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.PAUSED) {
      throw new Error(`Cannot heartbeat a session in ${session.status} state`);
    }
    await tx.studySession.update({ where: { id: sessionId }, data: { lastHeartbeatAt: new Date() } });
  });
}

export interface ClaimSessionResult {
  activeToken: string;
  status: SessionStatus;
}

/**
 * Explicit, user-initiated "take control here" — reissues activeToken.
 * See docs/architecture.md §Multi-tab safety. Never called automatically.
 */
export async function claimSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
): Promise<ClaimSessionResult> {
  return prisma.$transaction(async (tx) => {
    const session = await loadOwnedSession(tx, userId, sessionId);
    if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.PAUSED) {
      throw new SessionNotFoundError(sessionId);
    }
    const activeToken = randomUUID();
    await tx.studySession.update({
      where: { id: sessionId },
      data: { activeToken, lastHeartbeatAt: new Date() },
    });
    return { activeToken, status: session.status };
  });
}

/** RECOVERABLE --Resume--> RUNNING|PAUSED. Leaves the open interval as-is; the gap goes uncounted. */
export async function recoverResumeSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  token: string,
): Promise<StudySession> {
  return prisma.$transaction(async (tx) => {
    const session = await loadOwnedSession(tx, userId, sessionId);
    assertToken(session, token, sessionId);
    const now = new Date();
    await tx.sessionEvent.create({
      data: {
        sessionId,
        type: SessionEventType.SESSION_RECOVERED,
        occurredAt: now,
        metadata: { action: "resume" },
      },
    });
    return tx.studySession.update({ where: { id: sessionId }, data: { lastHeartbeatAt: now } });
  });
}

/**
 * RECOVERABLE --End Session--> COMPLETED. Closes the open interval at the
 * last known-good instant (typically lastHeartbeatAt), not "now" — see
 * docs/timer-state-machine.md §Recovery/long-gap policy.
 */
export function recoverEndSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  token: string,
  lastKnownGoodAt: Date,
): Promise<StudySession> {
  return completeSession(prisma, userId, sessionId, token, { endAt: lastKnownGoodAt, recovered: true });
}

export interface SessionReviewInput {
  categoryId?: string | null;
  productivityRating?: number | null;
  difficultyRating?: number | null;
  notes?: string | null;
}

/** Attaches the optional review (§13) to an already-COMPLETED session. */
export async function updateSessionReview(
  prisma: PrismaClient,
  userId: string,
  sessionId: string,
  review: SessionReviewInput,
): Promise<StudySession> {
  assertRating(review.productivityRating, "productivityRating");
  assertRating(review.difficultyRating, "difficultyRating");

  return prisma.$transaction(async (tx) => {
    const session = await loadOwnedSession(tx, userId, sessionId);
    if (session.status !== SessionStatus.COMPLETED) {
      throw new Error("Only a completed session can be reviewed");
    }
    await assertCategoryOwnership(tx, userId, review.categoryId);

    return tx.studySession.update({
      where: { id: sessionId },
      data: {
        categoryId: review.categoryId,
        productivityRating: review.productivityRating,
        difficultyRating: review.difficultyRating,
        notes: review.notes,
      },
    });
  });
}

/** The current user's ACTIVE/PAUSED session, if any, with its open interval. */
export async function getActiveSessionForUser(prisma: PrismaClient, userId: string) {
  return prisma.studySession.findFirst({
    where: { userId, status: { in: [SessionStatus.ACTIVE, SessionStatus.PAUSED] } },
    include: { intervals: { where: { endedAt: null } } },
  });
}
