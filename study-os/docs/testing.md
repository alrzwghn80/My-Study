# Testing strategy

Vitest for everything (unit + component); no separate E2E runner in the initial phases — added later if the manual browser QA pass in `run` (Phase 16) surfaces regressions that unit tests can't catch cheaply.

## What gets tested, and at what layer

**Domain logic (`src/server/domain/`) — the priority.** Pure functions, no database, no React: the timer state machine's transition function, streak/consistency/average calculators, the interval-splitting-at-midnight function, goal-versioning lookup. These are the highest-value tests because they encode every judgment call in `timer-state-machine.md`/`analytics.md` — a regression here silently corrupts historical statistics, which is the one failure mode the whole spec is designed to prevent (§58, §92).

- Timer: start, pause, resume, complete (from RUNNING and from PAUSED), cancel (from RUNNING and from PAUSED), multiple pause/resume cycles, complete-without-meaningful-duration, every invalid transition (start-while-running, resume-a-completed-session, etc.), the RECOVERABLE heartbeat-gap threshold at its exact boundary.
- Date handling: an interval that starts 23:40 and ends 00:20 splits into two rows with the correct `localDate` on each side; a session spanning a DST transition doesn't gain or lose an hour of focus time; changing `Settings.timezone` and rebuilding produces the same total focus time, redistributed correctly across days.
- Analytics: daily/weekly/monthly totals against a hand-built fixture of intervals with a known answer; streak calculation across a gap, across "today not yet studied" (should not break the streak), across exactly-threshold vs. one-second-under-threshold days; average (study-day vs. calendar-day) with a range containing zero study days (must not divide by zero); record detection after deleting the session that set the record (the record must recompute, not go stale — direct test of §58).
- Manual entries: creating one does not touch the timer state machine at all; editing or deleting one changes exactly the days/aggregates it touches and nothing else (a regression test against "editing yesterday's session doesn't corrupt today's total").

**Server Actions (`src/server/actions/`) — integration level, against a real test database.** Each action is tested through the actual Prisma client (a disposable schema/database, migrated fresh per test run — not mocked), because the properties that matter here are exactly the ones an in-memory mock would hide: the partial unique index actually rejects a second concurrent active session; a cascading delete actually removes a session's intervals; a transaction actually rolls back completely if one write in a "complete session" sequence fails (spec §59 atomicity) rather than leaving a half-written state.

**Components — light coverage, behavior not pixels.** The timer display renders the right state for RUNNING/PAUSED/RECOVERABLE; the session review modal's Save button is reachable within a couple of interactions (§13 — "should be able to save within a few seconds"); the manual-time-entry form rejects a future date without a round-trip to the server. Full visual/interaction QA of the dashboard happens via the `run` skill in a real browser (Phase 16), not by trying to snapshot-test every pixel.

## Explicit edge cases from spec §64, and where each is covered

| # | Case | Covered by |
|---|---|---|
| 1 | Double start | Domain: invalid-transition test. Integration: unique-index test. |
| 2–3 | Immediate pause / immediate resume | Domain: zero-duration interval handling — a sub-second interval still gets a row, still sums correctly, just doesn't move any percentage visibly. |
| 4 | Complete without meaningful duration | Domain: explicit test — allowed, not blocked (a genuine short session is legitimate per `timer-state-machine.md`'s Cancel-vs-Complete decision). |
| 5–6 | Refresh / close during active session | Architecture-level: no client state is authoritative, so this is "does a fresh load reconstruct the right state" — integration test loads session state from DB only. |
| 7 | 8-hour sleep | Domain: heartbeat-gap threshold test, both Resume and End Session branches. |
| 8 | Session crosses midnight | Domain: interval-splitting test (see Date handling above). |
| 9 | Timezone change | Domain: rebuild test (see Date handling above). |
| 10 | Edit yesterday's session | Integration: edit action + analytics recompute test. |
| 11 | Delete the session that set a record | Domain: record-recompute test. |
| 12 | Manual time for a future date | Integration: manual-entry action validation rejects it. |
| 13 | Two overlapping sessions | Integration: unique-index test (only one ACTIVE/PAUSED at a time is the actual prevention mechanism — true overlap of two *completed* manual/tracked entries is allowed, since real study can be logged after the fact against a different source). |
| 14–15 | DB request fails / network disappears | Component: client shows the "we couldn't save this session, state preserved locally" error path (§68) rather than losing data — tested by mocking the Server Action call to reject. |
| 16–17 | Multiple tabs, two tabs controlling the same session | Integration: `activeToken` mismatch is rejected. |
| 18–19 | System clock changes, DST | Domain: all persisted timestamps come from the server in the test harness too — a test that fakes the client clock and confirms it has no effect on stored data. |
| 20 | Rapid click Start/Pause/Resume | Integration: sequential Server Action calls against the real unique-index/token guards — confirms rapid double-fires collapse to one valid state instead of erroring the UI. |

## Running

`npm run test` (Vitest, watch mode locally / `--run` in CI). Domain tests need no database. Integration tests need `DATABASE_URL` pointed at a disposable Postgres (the same local cluster used for development is fine — tests run against a `study_os_test` database, migrated fresh, never the dev database).
