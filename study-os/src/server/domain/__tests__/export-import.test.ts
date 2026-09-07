import { describe, expect, it } from "vitest";
import { exportUserData, importUserData, backupSchema } from "@/server/domain/export-import";
import { addManualTime } from "@/server/domain/manual-entry";
import { startSession, completeSession } from "@/server/domain/timer/session-service";
import { createTestCategory, createTestUser, deleteTestUser, testDb } from "@/server/domain/timer/__tests__/test-db";
import { todayInTimezone } from "@/server/domain/calendar";

async function withUser<T>(fn: (user: Awaited<ReturnType<typeof createTestUser>>) => Promise<T>): Promise<T> {
  const user = await createTestUser();
  try {
    return await fn(user);
  } finally {
    await deleteTestUser(user.id);
  }
}

describe("export/import round trip", () => {
  it("exports everything and re-imports it into a fresh user without loss", async () => {
    await withUser(async (source) => {
      const category = await createTestCategory(source.id, "Grammar");
      await addManualTime(testDb, source.id, { date: todayInTimezone("UTC"), durationSeconds: 1800, categoryId: category.id, notes: "test" });
      const { sessionId, activeToken } = await startSession(testDb, source.id, category.id);
      await completeSession(testDb, source.id, sessionId, activeToken);
      await testDb.goal.create({ data: { userId: source.id, period: "DAILY", level: "TARGET", seconds: 9000, effectiveFrom: todayInTimezone("UTC") } });

      const backup = await exportUserData(testDb, source.id);
      expect(() => backupSchema.parse(backup)).not.toThrow();
      expect(backup.sessions).toHaveLength(2);

      await withUser(async (dest) => {
        const summary = await importUserData(testDb, dest.id, backup);
        expect(summary.sessionsImported).toBe(2);
        expect(summary.goalsUpserted).toBe(1);

        const destSessions = await testDb.studySession.findMany({ where: { userId: dest.id } });
        expect(destSessions).toHaveLength(2);
        const destIntervals = await testDb.sessionInterval.findMany({ where: { userId: dest.id } });
        expect(destIntervals.length).toBeGreaterThan(0);

        const destCategory = await testDb.category.findFirst({ where: { userId: dest.id, name: "Grammar" } });
        expect(destCategory).not.toBeNull();
        // Sessions should reference the destination user's own category, not the source's id.
        const manualDest = destSessions.find((s) => s.source === "MANUAL");
        expect(manualDest?.categoryId).toBe(destCategory!.id);
      });
    });
  });

  it("rejects malformed import data instead of inserting it", async () => {
    await withUser(async (user) => {
      await expect(importUserData(testDb, user.id, { not: "a backup" })).rejects.toThrow();
      const sessions = await testDb.studySession.findMany({ where: { userId: user.id } });
      expect(sessions).toHaveLength(0);
    });
  });

  it("re-importing the same backup does not duplicate categories or goals (upserted by natural key)", async () => {
    await withUser(async (source) => {
      await createTestCategory(source.id, "Listening");
      await testDb.goal.create({ data: { userId: source.id, period: "DAILY", level: "MINIMUM", seconds: 1800, effectiveFrom: todayInTimezone("UTC") } });
      const backup = await exportUserData(testDb, source.id);

      await withUser(async (dest) => {
        await importUserData(testDb, dest.id, backup);
        await importUserData(testDb, dest.id, backup);

        const categories = await testDb.category.findMany({ where: { userId: dest.id, name: "Listening" } });
        expect(categories).toHaveLength(1);
        const goals = await testDb.goal.findMany({ where: { userId: dest.id } });
        expect(goals).toHaveLength(1);
      });
    });
  });
});
