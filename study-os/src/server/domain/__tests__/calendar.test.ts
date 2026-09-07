import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetweenInclusive,
  endOfMonth,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "@/server/domain/calendar";

describe("calendar", () => {
  it("addDays rolls across month/year boundaries", () => {
    expect(addDays(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(addDays(new Date("2026-12-31T00:00:00Z"), 1).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it.each([
    ["2026-01-12", "2026-01-12"], // Monday
    ["2026-01-15", "2026-01-12"], // Thursday
    ["2026-01-18", "2026-01-12"], // Sunday
  ])("startOfWeek(%s) = %s (Monday-start)", (input, expected) => {
    expect(startOfWeek(new Date(`${input}T00:00:00Z`)).toISOString()).toBe(`${expected}T00:00:00.000Z`);
  });

  it("startOfMonth / endOfMonth", () => {
    const d = new Date("2026-02-17T00:00:00Z");
    expect(startOfMonth(d).toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(endOfMonth(d).toISOString()).toBe("2026-02-28T00:00:00.000Z"); // 2026 not a leap year
  });

  it("startOfYear", () => {
    expect(startOfYear(new Date("2026-07-04T00:00:00Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("daysBetweenInclusive counts both endpoints", () => {
    expect(daysBetweenInclusive(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"))).toBe(1);
    expect(daysBetweenInclusive(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-31T00:00:00Z"))).toBe(31);
  });
});
