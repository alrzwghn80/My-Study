// Pure timezone math for calendar-day attribution. Deliberately self-contained
// (Intl.DateTimeFormat only) rather than built on a library's "zoned Date"
// trick, because that trick's correctness depends on the Node process's own
// default timezone in ways that are easy to get subtly wrong across
// deployment environments. Every function here is independent of
// process.env.TZ / the system's default timezone — see docs/database.md
// §Timezone for why this matters.

/**
 * Minutes to ADD to `instant`'s epoch milliseconds (divided by 60000) to get
 * a value that, when read with `getUTC*` accessors, gives the wall-clock
 * date/time in `timeZone` at that instant.
 */
export function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Intl can report hour "24" for midnight under hourCycle h23 in some
  // environments; normalize it to 0.
  const hour = get("hour") % 24;

  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return Math.round((asUTC - instant.getTime()) / 60000);
}

/**
 * The calendar date `instant` falls on in `timeZone`, returned as a
 * UTC-midnight Date (matching how Prisma reads/writes a `@db.Date` column).
 */
export function localCalendarDate(instant: Date, timeZone: string): Date {
  const offset = tzOffsetMinutes(instant, timeZone);
  const wall = new Date(instant.getTime() + offset * 60_000);
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()));
}

/**
 * The real UTC instant of the next local midnight strictly after `instant`,
 * in `timeZone`. Resolved with one refinement pass to stay correct across a
 * DST transition landing between `instant` and that midnight.
 */
export function startOfNextLocalDay(instant: Date, timeZone: string): Date {
  const offset = tzOffsetMinutes(instant, timeZone);
  const wall = new Date(instant.getTime() + offset * 60_000);
  const nextWallMidnightMs = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + 1);

  const estimate = new Date(nextWallMidnightMs - offset * 60_000);
  const refinedOffset = tzOffsetMinutes(estimate, timeZone);
  return new Date(nextWallMidnightMs - refinedOffset * 60_000);
}

/**
 * The UTC instant of `hour:minute` wall-clock time on the given local
 * calendar date, in `timeZone`. Used to anchor manual time entries at local
 * noon — safely away from any midnight boundary regardless of timezone.
 */
export function zonedTimeToInstant(localDate: Date, hour: number, minute: number, timeZone: string): Date {
  const wallMs = Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate(),
    hour,
    minute,
  );
  const roughOffset = tzOffsetMinutes(new Date(wallMs), timeZone);
  const estimate = new Date(wallMs - roughOffset * 60_000);
  const refinedOffset = tzOffsetMinutes(estimate, timeZone);
  return new Date(wallMs - refinedOffset * 60_000);
}

export interface IntervalPiece {
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  localDate: Date;
}

/**
 * Splits [start, end) into one piece per local calendar day it touches, in
 * `timeZone`. This is the mechanism that keeps every `SessionInterval.localDate`
 * unambiguous — see docs/database.md §Study Session vs Session Interval.
 */
export function splitIntervalAtLocalMidnight(start: Date, end: Date, timeZone: string): IntervalPiece[] {
  if (end.getTime() <= start.getTime()) {
    throw new RangeError("Interval end must be strictly after start");
  }

  const pieces: IntervalPiece[] = [];
  let cursor = start;
  while (cursor.getTime() < end.getTime()) {
    const localDate = localCalendarDate(cursor, timeZone);
    const nextMidnight = startOfNextLocalDay(cursor, timeZone);
    const pieceEnd = nextMidnight.getTime() < end.getTime() ? nextMidnight : end;

    pieces.push({
      startedAt: cursor,
      endedAt: pieceEnd,
      durationSeconds: Math.round((pieceEnd.getTime() - cursor.getTime()) / 1000),
      localDate,
    });

    cursor = pieceEnd;
  }
  return pieces;
}
