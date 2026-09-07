import { describe, expect, it } from "vitest";
import {
  calendarDayAverage,
  computeStreaks,
  consistency,
  findNeglectedCategory,
  percentChange,
  studyDayAverage,
  studyDaysFrom,
  type CategoryTotal,
  type DailyTotal,
} from "@/server/domain/analytics";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("studyDaysFrom", () => {
  it("keeps only days at/above the threshold", () => {
    const totals: DailyTotal[] = [
      { date: d("2026-01-01"), focusSeconds: 1800, breakSeconds: 0 },
      { date: d("2026-01-02"), focusSeconds: 1799, breakSeconds: 0 },
      { date: d("2026-01-03"), focusSeconds: 3600, breakSeconds: 0 },
    ];
    const days = studyDaysFrom(totals, 1800);
    expect(days.map((x) => x.toISOString())).toEqual([
      "2026-01-01T00:00:00.000Z",
      "2026-01-03T00:00:00.000Z",
    ]);
  });
});

describe("computeStreaks", () => {
  it("is zero with no study days", () => {
    expect(computeStreaks([], d("2026-01-10"))).toEqual({ current: 0, longest: 0 });
  });

  it("counts a run ending today", () => {
    const days = [d("2026-01-08"), d("2026-01-09"), d("2026-01-10")];
    expect(computeStreaks(days, d("2026-01-10"))).toEqual({ current: 3, longest: 3 });
  });

  it("does not break the current streak if only yesterday was studied (today not over yet)", () => {
    const days = [d("2026-01-08"), d("2026-01-09")];
    expect(computeStreaks(days, d("2026-01-10")).current).toBe(2);
  });

  it("breaks the current streak once a full gap day has passed", () => {
    const days = [d("2026-01-05"), d("2026-01-06")];
    expect(computeStreaks(days, d("2026-01-10")).current).toBe(0);
  });

  it("longest streak finds the best historical run even if the current streak is shorter", () => {
    const days = [
      d("2026-01-01"),
      d("2026-01-02"),
      d("2026-01-03"),
      d("2026-01-04"),
      d("2026-01-05"), // 5-day run
      // gap
      d("2026-01-10"), // current: 1-day run (today)
    ];
    expect(computeStreaks(days, d("2026-01-10"))).toEqual({ current: 1, longest: 5 });
  });
});

describe("averages", () => {
  it("studyDayAverage divides by study days, not calendar days", () => {
    expect(studyDayAverage(36000, 10)).toBe(3600);
    expect(studyDayAverage(100, 0)).toBe(0); // no divide-by-zero
  });

  it("calendarDayAverage divides by calendar days", () => {
    expect(calendarDayAverage(36000, 30)).toBe(1200);
    expect(calendarDayAverage(100, 0)).toBe(0);
  });
});

describe("consistency", () => {
  it("is a plain ratio, zero-safe", () => {
    expect(consistency(24, 30)).toBeCloseTo(0.8);
    expect(consistency(0, 0)).toBe(0);
  });
});

describe("percentChange", () => {
  it("computes signed relative change", () => {
    expect(percentChange(120, 100)).toBeCloseTo(0.2);
    expect(percentChange(80, 100)).toBeCloseTo(-0.2);
  });

  it("returns null instead of dividing by zero when there is no previous total", () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});

describe("findNeglectedCategory", () => {
  const cat = (id: string, name: string, seconds: number): CategoryTotal => ({
    categoryId: id,
    categoryName: name,
    color: "#000",
    focusSeconds: seconds,
  });

  it("flags a category whose share dropped by more than half", () => {
    const previous = [cat("voc", "Vocabulary", 3600), cat("spk", "Speaking", 3600)];
    const current = [cat("voc", "Vocabulary", 7000), cat("spk", "Speaking", 200)];
    const result = findNeglectedCategory(current, previous);
    expect(result?.categoryName).toBe("Speaking");
  });

  it("returns null when nothing dropped meaningfully", () => {
    const previous = [cat("voc", "Vocabulary", 3600), cat("spk", "Speaking", 3600)];
    const current = [cat("voc", "Vocabulary", 3600), cat("spk", "Speaking", 3600)];
    expect(findNeglectedCategory(current, previous)).toBeNull();
  });

  it("returns null when either range has no data at all (avoids false positives on empty history)", () => {
    expect(findNeglectedCategory([], [cat("voc", "Vocabulary", 3600)])).toBeNull();
    expect(findNeglectedCategory([cat("voc", "Vocabulary", 3600)], [])).toBeNull();
  });
});
