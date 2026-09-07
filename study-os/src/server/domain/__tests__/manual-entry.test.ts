import { describe, expect, it } from "vitest";
import { addManualTime, deleteManualTime, editManualTime } from "@/server/domain/manual-entry";
import { getDailyTotals } from "@/server/domain/analytics";
import { SessionNotFoundError } from "@/server/domain/timer/errors";
import { createTestCategory, createTestUser, deleteTestUser, testDb } from "@/server/domain/timer/__tests__/test-db";
import { addDays, todayInTimezone } from "@/server/domain/calendar";

async function withUser<T>(fn: (user: Awaited<ReturnType<typeof createTestUser>>) => Promise<T>): Promise<T> {
  const user = await createTestUser();
  try {
    return await fn(user);
  } finally {
    await deleteTestUser(user.id);
  }
}

describe("addManualTime", () => {
  it("creates a MANUAL, already-COMPLETED session with one FOCUS interval on the given date", async () => {
    await withUser(async (user) => {
      const category = await createTestCategory(user.id, "Reading");
      const today = todayInTimezone("UTC");
      const session = await addManualTime(testDb, user.id, {
        date: today,
        durationSeconds: 2700,
        categoryId: category.id,
        notes: "Kapitel 7",
      });

      expect(session.source).toBe("MANUAL");
      expect(session.status).toBe("COMPLETED");
      expect(session.focusSeconds).toBe(2700);

      const totals = await getDailyTotals(testDb, user.id, today, today);
      expect(totals[0]?.focusSeconds).toBe(2700);
    });
  });

  it("rejects a future date", async () => {
    await withUser(async (user) => {
      const tomorrow = addDays(todayInTimezone("UTC"), 1);
      await expect(addManualTime(testDb, user.id, { date: tomorrow, durationSeconds: 600 })).rejects.toThrow(RangeError);
    });
  });

  it("rejects a non-positive duration", async () => {
    await withUser(async (user) => {
      const today = todayInTimezone("UTC");
      await expect(addManualTime(testDb, user.id, { date: today, durationSeconds: 0 })).rejects.toThrow(RangeError);
      await expect(addManualTime(testDb, user.id, { date: today, durationSeconds: -60 })).rejects.toThrow(RangeError);
    });
  });

  it("rejects a category belonging to a different user", async () => {
    await withUser(async (user) => {
      await withUser(async (other) => {
        const otherCategory = await createTestCategory(other.id);
        const today = todayInTimezone("UTC");
        await expect(
          addManualTime(testDb, user.id, { date: today, durationSeconds: 600, categoryId: otherCategory.id }),
        ).rejects.toThrow(SessionNotFoundError);
      });
    });
  });
});

describe("editManualTime", () => {
  it("changes the recorded duration/date and updates statistics for both the old and new day", async () => {
    await withUser(async (user) => {
      const today = todayInTimezone("UTC");
      const yesterday = addDays(today, -1);
      const session = await addManualTime(testDb, user.id, { date: yesterday, durationSeconds: 1800 });

      const edited = await editManualTime(testDb, user.id, session.id, { date: today, durationSeconds: 3600 });
      expect(edited.focusSeconds).toBe(3600);

      const totals = await getDailyTotals(testDb, user.id, yesterday, today);
      const yesterdayTotal = totals.find((t) => t.date.getTime() === yesterday.getTime());
      const todayTotal = totals.find((t) => t.date.getTime() === today.getTime());
      expect(yesterdayTotal).toBeUndefined(); // no longer attributed to yesterday
      expect(todayTotal?.focusSeconds).toBe(3600);
    });
  });

  it("only touches the day(s) it changes, not unrelated days", async () => {
    await withUser(async (user) => {
      const today = todayInTimezone("UTC");
      const yesterday = addDays(today, -1);
      await addManualTime(testDb, user.id, { date: yesterday, durationSeconds: 1200 });
      const target = await addManualTime(testDb, user.id, { date: today, durationSeconds: 1800 });

      await editManualTime(testDb, user.id, target.id, { durationSeconds: 2400 });

      const totals = await getDailyTotals(testDb, user.id, yesterday, today);
      expect(totals.find((t) => t.date.getTime() === yesterday.getTime())?.focusSeconds).toBe(1200);
      expect(totals.find((t) => t.date.getTime() === today.getTime())?.focusSeconds).toBe(2400);
    });
  });
});

describe("deleteManualTime", () => {
  it("removes the entry and its contribution to daily totals", async () => {
    await withUser(async (user) => {
      const today = todayInTimezone("UTC");
      const session = await addManualTime(testDb, user.id, { date: today, durationSeconds: 900 });
      await deleteManualTime(testDb, user.id, session.id);

      const totals = await getDailyTotals(testDb, user.id, today, today);
      expect(totals).toHaveLength(0);
    });
  });

  it("rejects deleting another user's entry", async () => {
    await withUser(async (user) => {
      await withUser(async (other) => {
        const today = todayInTimezone("UTC");
        const session = await addManualTime(testDb, other.id, { date: today, durationSeconds: 900 });
        await expect(deleteManualTime(testDb, user.id, session.id)).rejects.toThrow(SessionNotFoundError);
      });
    });
  });
});
