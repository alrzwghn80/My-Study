import { afterAll, describe, expect, it } from "vitest";
import { SessionEventType, SessionStatus, IntervalType } from "@/generated/prisma/enums";
import {
  cancelSession,
  claimSession,
  completeSession,
  getActiveSessionForUser,
  pauseSession,
  recordHeartbeat,
  recoverEndSession,
  recoverResumeSession,
  resumeSession,
  startSession,
  updateSessionReview,
} from "@/server/domain/timer/session-service";
import { SessionAlreadyActiveError, SessionNotFoundError, StaleControlTokenError } from "@/server/domain/timer/errors";
import { InvalidTransitionError } from "@/server/domain/timer/errors";
import { createTestCategory, createTestUser, deleteTestUser, testDb } from "./test-db";

async function withUser<T>(fn: (user: Awaited<ReturnType<typeof createTestUser>>) => Promise<T>): Promise<T> {
  const user = await createTestUser();
  try {
    return await fn(user);
  } finally {
    await deleteTestUser(user.id);
  }
}

afterAll(async () => {
  await testDb.$disconnect();
});

describe("startSession", () => {
  it("creates an ACTIVE session with an open FOCUS interval and creation events", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      expect(activeToken).toBeTruthy();

      const session = await testDb.studySession.findUniqueOrThrow({ where: { id: sessionId } });
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.activeToken).toBe(activeToken);

      const intervals = await testDb.sessionInterval.findMany({ where: { sessionId } });
      expect(intervals).toHaveLength(1);
      expect(intervals[0].type).toBe(IntervalType.FOCUS);
      expect(intervals[0].endedAt).toBeNull();

      const events = await testDb.sessionEvent.findMany({ where: { sessionId }, orderBy: { occurredAt: "asc" } });
      expect(events.map((e) => e.type)).toEqual([SessionEventType.SESSION_CREATED, SessionEventType.SESSION_STARTED]);
    });
  });

  it("rejects a second start while one session is already ACTIVE/PAUSED", async () => {
    await withUser(async (user) => {
      await startSession(testDb, user.id);
      await expect(startSession(testDb, user.id)).rejects.toThrow(SessionAlreadyActiveError);
    });
  });

  it("only lets one of two concurrent starts win the race", async () => {
    await withUser(async (user) => {
      const results = await Promise.allSettled([startSession(testDb, user.id), startSession(testDb, user.id)]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(SessionAlreadyActiveError);

      const sessions = await testDb.studySession.findMany({
        where: { userId: user.id, status: { in: [SessionStatus.ACTIVE, SessionStatus.PAUSED] } },
      });
      expect(sessions).toHaveLength(1);
    });
  });

  it("rejects a categoryId belonging to a different user", async () => {
    await withUser(async (user) => {
      await withUser(async (otherUser) => {
        const otherCategory = await createTestCategory(otherUser.id);
        await expect(startSession(testDb, user.id, otherCategory.id)).rejects.toThrow(SessionNotFoundError);
      });
    });
  });
});

describe("pause / resume", () => {
  it("pause closes FOCUS, opens BREAK, keeps the same session id, accrues focusSeconds", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      const paused = await pauseSession(testDb, user.id, sessionId, activeToken);
      expect(paused.id).toBe(sessionId);
      expect(paused.status).toBe(SessionStatus.PAUSED);
      expect(paused.focusSeconds).toBeGreaterThanOrEqual(0);

      const intervals = await testDb.sessionInterval.findMany({ where: { sessionId }, orderBy: { startedAt: "asc" } });
      expect(intervals.map((i) => i.type)).toEqual([IntervalType.FOCUS, IntervalType.BREAK]);
      expect(intervals[0].endedAt).not.toBeNull();
      expect(intervals[1].endedAt).toBeNull();
    });
  });

  it("resume closes BREAK, opens a new FOCUS interval, keeps the same session id", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      await pauseSession(testDb, user.id, sessionId, activeToken);
      const resumed = await resumeSession(testDb, user.id, sessionId, activeToken);
      expect(resumed.id).toBe(sessionId);
      expect(resumed.status).toBe(SessionStatus.ACTIVE);

      const intervals = await testDb.sessionInterval.findMany({ where: { sessionId }, orderBy: { startedAt: "asc" } });
      expect(intervals.map((i) => i.type)).toEqual([IntervalType.FOCUS, IntervalType.BREAK, IntervalType.FOCUS]);
      expect(intervals[2].endedAt).toBeNull();
    });
  });

  it("accumulates focusSeconds correctly across multiple pause/resume cycles", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);

      // Force the initial FOCUS interval to have started 10 seconds ago so pause() has real duration to record.
      await testDb.sessionInterval.updateMany({
        where: { sessionId, endedAt: null },
        data: { startedAt: new Date(Date.now() - 10_000) },
      });
      await pauseSession(testDb, user.id, sessionId, activeToken);
      await resumeSession(testDb, user.id, sessionId, activeToken);

      await testDb.sessionInterval.updateMany({
        where: { sessionId, endedAt: null },
        data: { startedAt: new Date(Date.now() - 15_000) },
      });
      const finalPause = await pauseSession(testDb, user.id, sessionId, activeToken);

      // Two FOCUS blocks of ~10s and ~15s => at least 24s total (allow scheduling slack, never less).
      expect(finalPause.focusSeconds).toBeGreaterThanOrEqual(24);
      expect(finalPause.focusSeconds).toBeLessThan(30);
    });
  });

  it("rejects pause/resume with a stale token", async () => {
    await withUser(async (user) => {
      const { sessionId } = await startSession(testDb, user.id);
      await expect(pauseSession(testDb, user.id, sessionId, "wrong-token")).rejects.toThrow(StaleControlTokenError);
    });
  });

  it("rejects pausing an already-paused session (invalid transition)", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      await pauseSession(testDb, user.id, sessionId, activeToken);
      await expect(pauseSession(testDb, user.id, sessionId, activeToken)).rejects.toThrow(InvalidTransitionError);
    });
  });

  it("handles an immediate pause (zero/near-zero duration) without error", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      const paused = await pauseSession(testDb, user.id, sessionId, activeToken);
      expect(paused.status).toBe(SessionStatus.PAUSED);
      expect(paused.focusSeconds).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("complete", () => {
  it("completes from ACTIVE, closing the FOCUS interval and clearing the token", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      const completed = await completeSession(testDb, user.id, sessionId, activeToken);
      expect(completed.status).toBe(SessionStatus.COMPLETED);
      expect(completed.completedAt).not.toBeNull();
      expect(completed.activeToken).toBeNull();

      const openIntervals = await testDb.sessionInterval.findMany({ where: { sessionId, endedAt: null } });
      expect(openIntervals).toHaveLength(0);

      const events = await testDb.sessionEvent.findMany({ where: { sessionId }, orderBy: { occurredAt: "asc" } });
      expect(events.at(-1)?.type).toBe(SessionEventType.SESSION_COMPLETED);
    });
  });

  it("completes from PAUSED, closing the BREAK interval as break time (not focus)", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      await pauseSession(testDb, user.id, sessionId, activeToken);
      const completed = await completeSession(testDb, user.id, sessionId, activeToken);
      expect(completed.status).toBe(SessionStatus.COMPLETED);
      expect(completed.breakSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  it("allows completing without meaningful duration (spec §64.4) — it counts, however short", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      const completed = await completeSession(testDb, user.id, sessionId, activeToken);
      expect(completed.status).toBe(SessionStatus.COMPLETED);
    });
  });

  it("rejects completing an already-completed session", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      await completeSession(testDb, user.id, sessionId, activeToken);
      await expect(completeSession(testDb, user.id, sessionId, activeToken)).rejects.toThrow(InvalidTransitionError);
    });
  });
});

describe("cancel", () => {
  it("discards every interval and zeroes totals, but keeps the audit event", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      await testDb.sessionInterval.updateMany({
        where: { sessionId, endedAt: null },
        data: { startedAt: new Date(Date.now() - 20 * 60_000) },
      });
      await pauseSession(testDb, user.id, sessionId, activeToken); // now has a closed FOCUS interval worth ~20 min
      const cancelled = await cancelSession(testDb, user.id, sessionId, activeToken);

      expect(cancelled.status).toBe(SessionStatus.CANCELLED);
      expect(cancelled.focusSeconds).toBe(0);
      expect(cancelled.breakSeconds).toBe(0);
      expect(cancelled.elapsedSeconds).toBe(0);

      const remainingIntervals = await testDb.sessionInterval.count({ where: { sessionId } });
      expect(remainingIntervals).toBe(0);

      const cancelEvent = await testDb.sessionEvent.findFirst({
        where: { sessionId, type: SessionEventType.SESSION_CANCELLED },
      });
      expect(cancelEvent).not.toBeNull();
    });
  });

  it("a cancelled session cannot contribute to any SessionInterval-based total (no join needed)", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      await cancelSession(testDb, user.id, sessionId, activeToken);
      const total = await testDb.sessionInterval.aggregate({
        where: { userId: user.id, type: IntervalType.FOCUS },
        _sum: { durationSeconds: true },
      });
      expect(total._sum.durationSeconds ?? 0).toBe(0);
    });
  });
});

describe("heartbeat", () => {
  it("updates lastHeartbeatAt for the token-holding tab", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      const before = await testDb.studySession.findUniqueOrThrow({ where: { id: sessionId } });
      await new Promise((r) => setTimeout(r, 5));
      await recordHeartbeat(testDb, user.id, sessionId, activeToken);
      const after = await testDb.studySession.findUniqueOrThrow({ where: { id: sessionId } });
      expect(after.lastHeartbeatAt!.getTime()).toBeGreaterThan(before.lastHeartbeatAt!.getTime());
    });
  });

  it("rejects a heartbeat with the wrong token", async () => {
    await withUser(async (user) => {
      const { sessionId } = await startSession(testDb, user.id);
      await expect(recordHeartbeat(testDb, user.id, sessionId, "wrong")).rejects.toThrow(StaleControlTokenError);
    });
  });

  it("rejects a heartbeat on a terminal session", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      await completeSession(testDb, user.id, sessionId, activeToken);
      await expect(recordHeartbeat(testDb, user.id, sessionId, activeToken)).rejects.toThrow();
    });
  });
});

describe("multi-tab: claimSession", () => {
  it("reissues the token; the old token stops working and the new one works", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken: oldToken } = await startSession(testDb, user.id);
      const { activeToken: newToken } = await claimSession(testDb, user.id, sessionId);
      expect(newToken).not.toBe(oldToken);

      await expect(pauseSession(testDb, user.id, sessionId, oldToken)).rejects.toThrow(StaleControlTokenError);
      const paused = await pauseSession(testDb, user.id, sessionId, newToken);
      expect(paused.status).toBe(SessionStatus.PAUSED);
    });
  });
});

describe("recovery", () => {
  it("recoverResumeSession logs SESSION_RECOVERED and leaves the open interval untouched", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      const openBefore = await testDb.sessionInterval.findFirstOrThrow({ where: { sessionId, endedAt: null } });

      await recoverResumeSession(testDb, user.id, sessionId, activeToken);

      const openAfter = await testDb.sessionInterval.findFirstOrThrow({ where: { sessionId, endedAt: null } });
      expect(openAfter.id).toBe(openBefore.id);
      expect(openAfter.startedAt.getTime()).toBe(openBefore.startedAt.getTime());

      const recoveredEvent = await testDb.sessionEvent.findFirst({
        where: { sessionId, type: SessionEventType.SESSION_RECOVERED },
      });
      expect(recoveredEvent).not.toBeNull();

      const session = await testDb.studySession.findUniqueOrThrow({ where: { id: sessionId } });
      expect(session.status).toBe(SessionStatus.ACTIVE); // untouched by resume-recovery
    });
  });

  it("recoverEndSession closes the interval at lastKnownGoodAt, not now, and completes the session", async () => {
    await withUser(async (user) => {
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      const startedAt = new Date(Date.now() - 3600_000); // simulate: interval opened an hour ago
      await testDb.sessionInterval.updateMany({ where: { sessionId, endedAt: null }, data: { startedAt } });

      const lastKnownGoodAt = new Date(startedAt.getTime() + 5 * 60_000); // heartbeat 5 min after start, then silence
      const completed = await recoverEndSession(testDb, user.id, sessionId, activeToken, lastKnownGoodAt);

      expect(completed.status).toBe(SessionStatus.COMPLETED);
      expect(completed.completedAt?.getTime()).toBe(lastKnownGoodAt.getTime());
      // ~5 minutes of focus credited, NOT the ~60 minutes of wall-clock gap.
      expect(completed.focusSeconds).toBeGreaterThanOrEqual(295);
      expect(completed.focusSeconds).toBeLessThanOrEqual(305);

      // Both events are logged at the moment the recovery decision is
      // recorded (not backdated to endAt), so they can share a timestamp
      // within one transaction — order between them isn't guaranteed, only
      // that both exist.
      const events = await testDb.sessionEvent.findMany({ where: { sessionId } });
      const eventTypes = events.map((e) => e.type);
      expect(eventTypes).toContain(SessionEventType.SESSION_RECOVERED);
      expect(eventTypes).toContain(SessionEventType.SESSION_COMPLETED);
    });
  });
});

describe("session review", () => {
  it("attaches review data to a completed session and validates ratings", async () => {
    await withUser(async (user) => {
      const category = await createTestCategory(user.id, "Vocabulary");
      const { sessionId, activeToken } = await startSession(testDb, user.id);
      await completeSession(testDb, user.id, sessionId, activeToken);

      const reviewed = await updateSessionReview(testDb, user.id, sessionId, {
        categoryId: category.id,
        productivityRating: 4,
        difficultyRating: 2,
        notes: "Kapitel 7",
      });
      expect(reviewed.categoryId).toBe(category.id);
      expect(reviewed.productivityRating).toBe(4);
      expect(reviewed.notes).toBe("Kapitel 7");

      await expect(
        updateSessionReview(testDb, user.id, sessionId, { productivityRating: 6 }),
      ).rejects.toThrow(RangeError);
    });
  });

  it("rejects reviewing a session that isn't completed", async () => {
    await withUser(async (user) => {
      const { sessionId } = await startSession(testDb, user.id);
      await expect(updateSessionReview(testDb, user.id, sessionId, { notes: "too soon" })).rejects.toThrow();
    });
  });
});

describe("getActiveSessionForUser", () => {
  it("returns null when there is no active session", async () => {
    await withUser(async (user) => {
      const active = await getActiveSessionForUser(testDb, user.id);
      expect(active).toBeNull();
    });
  });

  it("returns the session with its open interval when one is running", async () => {
    await withUser(async (user) => {
      const { sessionId } = await startSession(testDb, user.id);
      const active = await getActiveSessionForUser(testDb, user.id);
      expect(active?.id).toBe(sessionId);
      expect(active?.intervals).toHaveLength(1);
    });
  });
});
