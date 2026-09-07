import { describe, expect, it } from "vitest";
import { computeLongTermGoalProgress, evaluateGoalCompletion } from "@/server/domain/goals";

describe("evaluateGoalCompletion", () => {
  it("marks each level independently", () => {
    const goals = { minimum: 1800, target: 9000, stretch: 12600 };
    expect(evaluateGoalCompletion(5000, goals)).toEqual({ minimum: true, target: false, stretch: false });
    expect(evaluateGoalCompletion(9000, goals)).toEqual({ minimum: true, target: true, stretch: false });
    expect(evaluateGoalCompletion(0, goals)).toEqual({ minimum: false, target: false, stretch: false });
  });

  it("treats an unset level as never completed", () => {
    const goals = { minimum: null, target: 9000, stretch: null };
    expect(evaluateGoalCompletion(999999, goals)).toEqual({ minimum: false, target: true, stretch: false });
  });
});

describe("computeLongTermGoalProgress", () => {
  const today = new Date("2026-06-01T00:00:00.000Z");

  it("computes progress as a 0..1 fraction, capped at 1", () => {
    const p = computeLongTermGoalProgress({
      id: "1",
      title: "German B2",
      targetSeconds: 1_800_000, // 500h
      targetDate: null,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      completedSeconds: 460_800, // 128h
      today,
    });
    expect(p.progress).toBeCloseTo(128 / 500, 3);
  });

  it("caps progress at 1 even if completed exceeds target", () => {
    const p = computeLongTermGoalProgress({
      id: "1",
      title: "German B2",
      targetSeconds: 1000,
      targetDate: null,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      completedSeconds: 5000,
      today,
    });
    expect(p.progress).toBe(1);
  });

  it("computes required daily pace only when a target date is set", () => {
    const withDate = computeLongTermGoalProgress({
      id: "1",
      title: "x",
      targetSeconds: 36000,
      targetDate: new Date("2026-06-11T00:00:00.000Z"), // 10 days out
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      completedSeconds: 18000,
      today,
    });
    expect(withDate.requiredDailyPaceSeconds).toBeCloseTo(1800, 0);

    const withoutDate = computeLongTermGoalProgress({
      id: "1",
      title: "x",
      targetSeconds: 36000,
      targetDate: null,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      completedSeconds: 18000,
      today,
    });
    expect(withoutDate.requiredDailyPaceSeconds).toBeNull();
  });

  it("estimates completion from real historical pace, never a fixed assumption", () => {
    // 100 days elapsed, 100,000s completed => pace 1000s/day. Remaining 50,000s => 50 more days.
    const start = new Date(today.getTime() - 100 * 86_400_000);
    const p = computeLongTermGoalProgress({
      id: "1",
      title: "x",
      targetSeconds: 150_000,
      targetDate: null,
      startDate: start,
      completedSeconds: 100_000,
      today,
    });
    expect(p.estimatedCompletionDate).not.toBeNull();
    const daysOut = Math.round((p.estimatedCompletionDate!.getTime() - today.getTime()) / 86_400_000);
    expect(daysOut).toBe(50);
  });

  it("estimated completion is today once the goal is already met", () => {
    const p = computeLongTermGoalProgress({
      id: "1",
      title: "x",
      targetSeconds: 1000,
      targetDate: null,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      completedSeconds: 1000,
      today,
    });
    expect(p.estimatedCompletionDate?.getTime()).toBe(today.getTime());
  });
});
