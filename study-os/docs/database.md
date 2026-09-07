# Database

Full field-level definitions live in `prisma/schema.prisma` as inline comments; this document explains the *why* behind the shape, per spec §16/§36/§85. Single-user app, but every table carries a real `userId` FK (spec §72: ready for a second user later, never built as multi-tenant UI/logic now).

## Entity overview

```
User ─┬─ Settings (1:1, singleton)
      ├─ Category (1:N) ──────────────┐
      ├─ StudySession (1:N) ──────────┤ categoryId (nullable FK)
      │     ├─ SessionEvent (1:N)     │
      │     └─ SessionInterval (1:N) ─┘
      ├─ Goal (1:N, versioned)
      ├─ LongTermGoal (1:N)
      └─ Achievement (1:N)
```

Personal records (§22) and every daily/weekly/monthly/yearly total (§16/§19/§20/§21) are **not tables** — they're queries over `SessionInterval`, computed on demand. See "Why no DailyStats/Records tables" below.

## Auth

`User { id, email, passwordHash, createdAt }`. NextAuth is configured with the Credentials provider and JWT session strategy, so no `Account`/`Session`/`VerificationToken` adapter tables are needed — a JWT session is self-contained and verified against `passwordHash` only at login. Simplest option that satisfies §35 ("keep authentication simple and appropriate for a single private user") while still going through real auth (the app "may run on a VPS," per the same section).

## Category doubles as Skill

The spec lists "German Study Categories" (§12: Grammar, Vocabulary, Listening, …) and later "Skill Distribution" (§26: Vocabulary, Grammar, Listening, …) using the same list of terms. Rather than build two parallel taxonomies that would need to be kept in sync for no benefit, `Category` is the single taxonomy and "skill distribution" charts are category-distribution charts. Flagged per §95 as a resolved ambiguity, not a silent scope cut — nothing in the spec's example output depends on category and skill being different lists.

`isArchived` instead of delete: a category referenced by two years of history must never disappear from that history (spec §15: "prevent accidental corruption of statistics"). Archiving hides it from the picker for new sessions while every past session keeps its label and its place in charts.

## Study Session vs. Session Interval — why two tables and not one

`StudySession` is the *container* a user thinks in terms of ("today's 2pm grammar session"). `SessionInterval` is the *canonical time-accounting unit* — one row per uninterrupted focus or break block. This split exists because of §9 and §39 combined:

- §9 forbids `studyTime = end - start`; real focus time is the sum of the FOCUS blocks only, so those blocks have to be individually addressable rows, not a single start/end pair on the session.
- §39 requires that a session crossing midnight attribute its time to the correct calendar day on each side of midnight. A single `startedAt`/`endedAt` pair can't do this without runtime timezone math on every query. Instead, **each interval is split into multiple rows at every local-midnight boundary at the moment it's closed** (pause, complete, or recovery end), so `SessionInterval.localDate` is always a single unambiguous date per row, computed once and stored. Example: a FOCUS interval from 23:40 to 00:20 (Europe/Berlin) becomes two rows — 23:40–00:00 with `localDate` = day 1, and 00:00–00:20 with `localDate` = day 2. Every daily/weekly/monthly aggregate is then a plain `SUM(durationSeconds) WHERE localDate BETWEEN … GROUP BY localDate` — correct by construction, no per-query timezone conversion, and fast (`@@index([userId, localDate])`).

`StudySession.focusSeconds`/`breakSeconds`/`elapsedSeconds` are a denormalized cache of the sums of its own intervals, updated in the same transaction as every state transition. They exist purely so the UI can show "this session so far: 42m" without a join, and are fully rebuildable (`SELECT SUM(durationSeconds) FROM SessionInterval WHERE sessionId = ?`) — satisfying §36's rule that any denormalized data must be safely rebuildable and never the sole source of truth.

## Timezone

`Settings.timezone` is the single source of truth for calendar-day boundaries (spec §38). It's read once per write (when closing an interval, to compute `localDate`), not re-derived per query. **If the user changes their timezone**, historical `localDate` values are *not* silently correct for the new zone — they were computed against the zone in effect at the time. Changing timezone triggers a rebuild job (re-walk `SessionEvent` for every session and regenerate `SessionInterval` rows) rather than reinterpreting old rows in place, so history stays internally consistent with whichever zone was actually configured on each day. This rebuild is the same code path used for any other interval-derived-data repair, per §36's "must be safely rebuildable."

## Goal versioning

`Goal` is not one row per period type — it's versioned by `effectiveFrom`. Changing today's daily target inserts a new row rather than updating the existing one; evaluating "was I on track on March 3rd" always uses the goal row with the latest `effectiveFrom <= March 3rd`. Without this, raising your target today would retroactively make every past day that used to be "goal completed" show as incomplete. This is a resolved ambiguity (spec §95) — §27 says goals "should be stored in the database" but doesn't specify whether they're retroactive; versioning is the only choice consistent with §58 ("records must be historically correct... do not leave stale records").

## Why no `DailyStats`/`Records` tables

§16 explicitly allows aggregate tables only if performance requires them and they're "safely rebuildable," and never as "the only source of truth." Given Postgres's indexing on `(userId, localDate)`, a full year of daily totals is a single indexed `GROUP BY` — fast enough that a cache table would add write-path complexity (keep it in sync on every interval close, every manual-entry edit, every deletion) for no measured benefit yet. Personal records (§22, §58) are the sharper case: "if I delete a session, records must update" is trivially, automatically true if a record is `MAX(...)` computed live, and requires active invalidation logic if it's a stored value. Computing live is the simpler design that can't go stale. If a specific query proves too slow under real data volume, the fix is `unstable_cache`/memoization at the query layer first, then a rebuildable materialized view — not a denormalized table treated as ground truth.

## Achievements are the one exception

`Achievement.unlockedAt` **is** persisted, deliberately, because it's not purely derivable: it's *when* a threshold was first crossed, and if the threshold list changes later (e.g. a 750-hour tier is added), there's no way to reconstruct historically when that would have unlocked without replaying the entire session history against the old threshold set. Persisting the unlock event is data, not a cache.

## Indexes

- `SessionInterval(userId, localDate)` — every daily/weekly/monthly aggregation query.
- `SessionInterval(sessionId)` — rebuilding a session's totals, showing its timeline.
- `StudySession(userId, status)` — finding the current active/paused session (also backed by the partial unique index below).
- `StudySession(userId, createdAt)`, `StudySession(userId, source)` — history page filtering.
- `SessionEvent(sessionId, occurredAt)` — reconstructing a session's audit trail in order.
- `Category(userId, isArchived)` — category picker excludes archived by default.
- `Goal(userId, period, effectiveFrom)` — "which goal was active on date X" lookups.

## Data integrity constraints enforced at the DB level, not just app code

- `one_active_or_paused_session_per_user` — partial unique index on `StudySession(userId) WHERE status IN ('ACTIVE','PAUSED')`. Hand-written SQL migration (Prisma's schema DSL has no partial-index syntax) — see `prisma/migrations/20260907075129_one_active_session_per_user/`. This is the actual backstop for §34's "prevent overlapping active sessions" and §65's multi-tab safety; app-layer checks are the first line of defense but a DB constraint is what makes it impossible even under a race.
- Cascading deletes (`onDelete: Cascade`) from `User` down through every table, and from `StudySession` to its `SessionEvent`/`SessionInterval` rows — deleting a session cannot leave orphaned interval rows that would silently inflate a future aggregate query.
