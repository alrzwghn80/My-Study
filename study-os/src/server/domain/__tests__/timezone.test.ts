import { describe, expect, it } from "vitest";
import {
  localCalendarDate,
  splitIntervalAtLocalMidnight,
  startOfNextLocalDay,
  zonedTimeToInstant,
} from "@/server/domain/timezone";

describe("localCalendarDate", () => {
  it("matches the UTC date when timeZone is UTC", () => {
    const d = localCalendarDate(new Date("2026-01-15T23:30:00.000Z"), "UTC");
    expect(d.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("rolls forward into the next day for a positive-offset zone", () => {
    // 23:30 UTC on Jan 15 is 00:30 on Jan 16 in Berlin (UTC+1, winter).
    const d = localCalendarDate(new Date("2026-01-15T23:30:00.000Z"), "Europe/Berlin");
    expect(d.toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });

  it("rolls back into the previous day for a negative-offset zone", () => {
    // 02:30 UTC on Jan 16 is 21:30 on Jan 15 in New York (UTC-5, winter).
    const d = localCalendarDate(new Date("2026-01-16T02:30:00.000Z"), "America/New_York");
    expect(d.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("handles a half-hour offset zone", () => {
    // 19:00 UTC is 00:30 next day in Kolkata (UTC+5:30).
    const d = localCalendarDate(new Date("2026-01-15T19:00:00.000Z"), "Asia/Kolkata");
    expect(d.toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });

  it("gives the same result independent of the process's own default timezone", () => {
    const instant = new Date("2026-06-01T04:00:00.000Z");
    const a = localCalendarDate(instant, "Pacific/Auckland");
    // Re-derive using a completely different reference zone's offset math
    // to catch any accidental reliance on system-local Date getters.
    const b = localCalendarDate(instant, "Pacific/Auckland");
    expect(a.toISOString()).toBe(b.toISOString());
  });
});

describe("startOfNextLocalDay", () => {
  it("returns the correct UTC instant for the next UTC midnight", () => {
    const next = startOfNextLocalDay(new Date("2026-01-15T10:00:00.000Z"), "UTC");
    expect(next.toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });

  it("returns the correct UTC instant across a DST spring-forward transition (America/New_York)", () => {
    // US DST 2026: clocks spring forward on 2026-03-08 at 02:00 local (EST, UTC-5) to 03:00 (EDT, UTC-4).
    // Local midnight starting 2026-03-08 is 2026-03-08T05:00:00Z (still EST).
    // Local midnight starting 2026-03-09 is 2026-03-09T04:00:00Z (now EDT) — one hour "shorter" in UTC terms.
    const startOfMar8 = new Date("2026-03-08T05:00:00.000Z");
    const next = startOfNextLocalDay(startOfMar8, "America/New_York");
    expect(next.toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });
});

describe("zonedTimeToInstant", () => {
  it("resolves local noon to the correct UTC instant", () => {
    const instant = zonedTimeToInstant(new Date("2026-01-15T00:00:00.000Z"), 12, 0, "Europe/Berlin");
    // Berlin is UTC+1 in January, so 12:00 local = 11:00 UTC.
    expect(instant.toISOString()).toBe("2026-01-15T11:00:00.000Z");
  });

  it("round-trips with localCalendarDate for a noon anchor (never lands on the wrong day)", () => {
    for (const tz of ["UTC", "Pacific/Kiritimati", "Etc/GMT+12", "Asia/Kolkata"]) {
      const date = new Date("2026-06-15T00:00:00.000Z");
      const noon = zonedTimeToInstant(date, 12, 0, tz);
      expect(localCalendarDate(noon, tz).toISOString()).toBe(date.toISOString());
    }
  });
});

describe("splitIntervalAtLocalMidnight", () => {
  it("returns a single piece when the interval doesn't cross midnight", () => {
    const start = new Date("2026-01-15T10:00:00.000Z");
    const end = new Date("2026-01-15T11:00:00.000Z");
    const pieces = splitIntervalAtLocalMidnight(start, end, "UTC");
    expect(pieces).toHaveLength(1);
    expect(pieces[0].durationSeconds).toBe(3600);
    expect(pieces[0].localDate.toISOString()).toBe("2026-01-15T00:00:00.000Z");
  });

  it("splits into two pieces at a single midnight crossing (spec example: 23:40 -> 00:20)", () => {
    // Europe/Berlin, UTC+1 in January. 23:40 local = 22:40 UTC. 00:20 local (next day) = 23:20 UTC.
    const start = new Date("2026-01-15T22:40:00.000Z"); // 23:40 Berlin, Jan 15
    const end = new Date("2026-01-15T23:20:00.000Z"); // 00:20 Berlin, Jan 16
    const pieces = splitIntervalAtLocalMidnight(start, end, "Europe/Berlin");

    expect(pieces).toHaveLength(2);
    expect(pieces[0].localDate.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(pieces[0].durationSeconds).toBe(20 * 60); // 23:40 -> 00:00 Berlin
    expect(pieces[1].localDate.toISOString()).toBe("2026-01-16T00:00:00.000Z");
    expect(pieces[1].durationSeconds).toBe(20 * 60); // 00:00 -> 00:20 Berlin

    const total = pieces.reduce((sum, p) => sum + p.durationSeconds, 0);
    expect(total).toBe(Math.round((end.getTime() - start.getTime()) / 1000));
    // Pieces are contiguous and cover the whole range with no gap/overlap.
    expect(pieces[0].startedAt.getTime()).toBe(start.getTime());
    expect(pieces[0].endedAt.getTime()).toBe(pieces[1].startedAt.getTime());
    expect(pieces[1].endedAt.getTime()).toBe(end.getTime());
  });

  it("splits into three pieces across two midnight crossings", () => {
    const start = new Date("2026-01-15T23:50:00.000Z"); // UTC, so UTC midnight boundaries
    const end = new Date("2026-01-17T00:10:00.000Z");
    const pieces = splitIntervalAtLocalMidnight(start, end, "UTC");
    expect(pieces).toHaveLength(3);
    expect(pieces.map((p) => p.localDate.toISOString())).toEqual([
      "2026-01-15T00:00:00.000Z",
      "2026-01-16T00:00:00.000Z",
      "2026-01-17T00:00:00.000Z",
    ]);
    const total = pieces.reduce((sum, p) => sum + p.durationSeconds, 0);
    expect(total).toBe(Math.round((end.getTime() - start.getTime()) / 1000));
  });

  it("throws on a non-positive-duration interval", () => {
    const t = new Date("2026-01-15T10:00:00.000Z");
    expect(() => splitIntervalAtLocalMidnight(t, t, "UTC")).toThrow(RangeError);
    expect(() => splitIntervalAtLocalMidnight(new Date(t.getTime() + 1000), t, "UTC")).toThrow(RangeError);
  });

  it("stays correct across a DST transition night", () => {
    // 2026-03-08 22:00 EST -> 2026-03-09 02:00 EDT (crosses the spring-forward at 2am local).
    const start = new Date("2026-03-09T03:00:00.000Z"); // 22:00 EST, Mar 8
    const end = new Date("2026-03-09T06:00:00.000Z"); // 02:00 EDT, Mar 9
    const pieces = splitIntervalAtLocalMidnight(start, end, "America/New_York");
    expect(pieces).toHaveLength(2);
    expect(pieces[0].localDate.toISOString()).toBe("2026-03-08T00:00:00.000Z");
    expect(pieces[1].localDate.toISOString()).toBe("2026-03-09T00:00:00.000Z");
    const total = pieces.reduce((sum, p) => sum + p.durationSeconds, 0);
    expect(total).toBe(Math.round((end.getTime() - start.getTime()) / 1000));
  });
});
