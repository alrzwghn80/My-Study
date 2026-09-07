# Analytics

Every metric below is defined precisely once here; UI copy and chart labels must match these definitions exactly (spec §57 — "make these definitions consistent everywhere"). All formulas operate on `SessionInterval` rows (canonical), never on `StudySession.focusSeconds` cache directly, except where noted as a display-only shortcut.

## Core aggregation

```
dailyFocusSeconds(userId, date) =
  SUM(durationSeconds) FROM SessionInterval
  WHERE userId = ? AND localDate = ? AND type = 'FOCUS'

dailyBreakSeconds(userId, date) = same, type = 'BREAK'
```

Weekly/monthly/yearly totals are the same query with `localDate BETWEEN start AND end`, where the week/month/year boundaries are computed in `Settings.timezone` (a "week" is Monday–Sunday in the user's local calendar, not UTC).

## Study day

> A calendar day whose `dailyFocusSeconds` >= `Settings.streakThresholdSeconds` (default 30 minutes, spec §24).

Explicitly **not** "timer was started" — a 3-minute false start does not count. This threshold is a `Settings` field precisely so it's configurable rather than a hardcoded assumption per §24.

## Streak

```
currentStreak = count of consecutive study days ending TODAY OR YESTERDAY,
                walking backward from the most recent study day.
```

Ending "today or yesterday" (not strictly today) matters because a streak shouldn't visibly break at 12:01am before the user has had a chance to study today — it breaks only once a full calendar day passes with no qualifying focus time. `longestStreak` is the maximum length of any such consecutive run in history, computed by walking the full sorted list of study days and finding the longest gap-free run (gap = 1 day, tolerance already built into "today or yesterday" for the *current* streak only — `longestStreak` uses strict day-adjacency for past runs, since those are settled history, not an in-progress countdown).

## Consistency

```
consistency(range) = studyDaysInRange / calendarDaysInRange
```

Rendered as a whole-number percentage (spec §82 — no fake precision, "80%" not "80.3333%"). Default range: trailing 30 days.

## Averages

```
studyDayAverage(range)    = totalFocusSeconds(range) / studyDaysInRange
calendarDayAverage(range) = totalFocusSeconds(range) / calendarDaysInRange
```

Both are shown side by side wherever "average" appears (§20) because they answer different questions — "how much do I study on days I study" vs. "how much do I study per day overall, including gaps."

## Goal completion

For a given day and `GoalLevel` (MINIMUM/TARGET/STRETCH):
```
goalSeconds(day, level) = the Goal row for this user/period=DAILY/level
                           with the latest effectiveFrom <= day
completed(day, level)   = dailyFocusSeconds(day) >= goalSeconds(day, level)
```
Weekly/monthly goal completion is the same shape against the weekly/monthly total and a `period=WEEKLY`/`MONTHLY` goal row. See `database.md` §Goal versioning for why the lookup is "latest effective row as of that day," not "current goal."

## Personal records

All computed live (see `database.md` §Why no Records table), each a simple aggregate over `SessionInterval`/`StudySession`:

| Record | Query shape |
|---|---|
| Longest study day | `MAX(dailyFocusSeconds)` across all days |
| Longest single session | `MAX(focusSeconds)` across COMPLETED `StudySession` rows |
| Longest streak | see Streak above |
| Most study days in a month | `MAX` over months of `COUNT(DISTINCT localDate WHERE dailyFocusSeconds >= threshold)` |
| Most focus time in a week / month | `MAX` over weeks/months of the weekly/monthly total |
| Most sessions in a day | `MAX` over days of `COUNT(StudySession WHERE status='COMPLETED')` grouped by the day its intervals fall on |
| Highest daily/weekly/monthly goal ever set | `MAX(seconds)` over `Goal` rows for that period |

"Record broken" detection (for the record-chasing UX, §23) is: `currentPeriodTotalSoFar > previousRecordExcludingCurrentPeriod`. The comparison always excludes the in-progress period itself from the "previous record" side, so a day can't be compared against itself while it's still accumulating.

## Skill/category distribution

```
categoryDistribution(range) =
  GROUP BY categoryId: SUM(focusSeconds) FROM StudySession
  JOIN SessionInterval WHERE localDate IN range AND type = 'FOCUS'
```

The "neglected skill" note (§26 — "Speaking has received significantly less time than Vocabulary this month") is generated only from this real distribution: flag a category if its share of total time this month is less than half its share last month, or if a category has zero time this month while it had nonzero time in each of the prior two months. No invented thresholds beyond that — this stays a data observation, not a psychological claim, per §26's own instruction.

## Weekly/monthly/yearly report figures

Every number in the report templates (§31 Weekly Report, §20 Monthly Analytics) is one of the primitives above:
- "Best Day" = `argmax` of `dailyFocusSeconds` within the range.
- "Most/Least Studied Skill" = `argmax`/`argmin` of `categoryDistribution` within the range.
- "Compared With Previous Week/Month" = `(thisRangeTotal - previousRangeTotal) / previousRangeTotal`, shown as a signed rounded percentage; if `previousRangeTotal = 0`, show "New" instead of dividing by zero.

## Long-term goal pace

```
progress          = completedSecondsSince(startDate) / targetSeconds
requiredDailyPace  = (targetSeconds - completedSoFar) / daysRemaining   // only if targetDate set
estimatedCompletion = startDate + (targetSeconds / averageDailyPaceSince(startDate))
```

`estimatedCompletion` is always labeled "estimated" in the UI and computed from the *actual* historical average pace, never a fixed assumption — per §28's instruction to "clearly distinguish estimates from facts."

## Performance

No metric here requires scanning more than one indexed range of `SessionInterval` (`@@index([userId, localDate])`). Where a page needs several of these at once (e.g. the dashboard needs today/this-week/streak/records simultaneously), they're fetched in parallel in the Server Component, not serially. If a specific query proves slow under real data volume, `unstable_cache` at the query-function level is the first lever (per `database.md`'s rebuildable-cache stance) before introducing a stored aggregate table.
