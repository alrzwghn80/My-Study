# Product Spec — Personal German Study OS

A private, single-user study-tracking platform whose purpose is to make German study measurable, visible, and hard to ignore. Full philosophy, UX requirements, and behavioral rationale live in the original 97-section specification (kept outside this repo, in the conversation history that commissioned this project) — this document tracks what's actually being built, the pages, and every place the implementation had to resolve an ambiguity the spec left open.

## Product philosophy (unchanged from spec)

> Study → Record → Analyze → Compare → Improve → Study more.

Motivation comes from measurable progress, visible consistency, personal records, and honest data — not gamification. See `analytics.md`'s "no fake precision" and "neglected skill" sections for how this constrains even the copy.

## Pages

- **Dashboard** (`/`) — timer, today's goal progress, streak, weekly progress, records, activity calendar, analytics summary. Priority order for what's visible without scrolling: timer → today's progress → streak → next action → weekly progress → records → calendar → analytics summary (spec §53).
- **Analytics** (`/analytics`) — weekly/monthly/yearly breakdowns, category/skill distribution, consistency.
- **History** (`/history`) — full session list with filters (date range, category, tracked/manual, completed/cancelled, min duration) and search over notes.
- **Goals** (`/goals`) — daily/weekly/monthly targets (minimum/target/stretch) and the long-term goal.
- **Settings** (`/settings`) — timezone, targets, timer behavior, motivation thresholds, appearance.

No other pages. No teams, social feed, public profile, or multi-tenant billing (spec §35).

## Resolved ambiguities (spec §95 — flagged, not silently decided)

| Spec area | Ambiguity | Resolution | Rationale |
|---|---|---|---|
| §8 Cancel | Does Cancel keep focus time already accrued before the cancel? | Cancel voids the entire session; only Complete finalizes accrued time. | `timer-state-machine.md` §Decision: Cancel discards the whole session |
| §12 vs §26 | "Category" and "Skill" are given the same example list — one taxonomy or two? | One taxonomy (`Category`), reused as both. | `database.md` §Category doubles as Skill |
| §16/§58 | Store daily aggregates / personal records, or compute live? | Compute live from `SessionInterval`; no `DailyStats`/`Records` table. | `database.md` §Why no DailyStats/Records tables |
| §27 Goals | Are past days evaluated against today's target if it changes? | No — goals are versioned by `effectiveFrom`; past days use the goal that was active on that day. | `database.md` §Goal versioning |
| §32 Recovery | What exactly counts as "the user was studying" during a long gap? | A heartbeat every 20s; gaps ≥5 min never get silently credited — user is always asked. | `timer-state-machine.md` §Recovery/long-gap policy |

## Implementation status

Phases follow spec §86:

- [x] Phase 1 — Repository inspection and architecture (this document set).
- [x] Phase 2 — Database schema and migrations (`prisma/schema.prisma`, applied and verified against a local Postgres).
- [x] Phase 3 — Session domain model **and** Phase 4 — Timer state machine (implemented together, per user direction): `src/server/domain/timezone.ts` (pure interval-splitting/DST-safe timezone math), `src/server/domain/timer/transitions.ts` (pure FSM table), `src/server/domain/timer/recovery.ts` (pure heartbeat-staleness gate), `src/server/domain/timer/session-service.ts` (start/pause/resume/complete/cancel/heartbeat/claim/recover/review, each atomic via `prisma.$transaction`). 61 tests (35 pure unit + 26 integration against a real disposable Postgres database), `tsc --noEmit` and `eslint` both clean. Two real bugs were caught and fixed by the integration tests before this was considered done — see git history on this phase's commit for what they were and why the fix is the way it is.
- [x] Phase 5 — Persistence and recovery: `src/server/actions/timer.ts` (thin auth-check-then-domain-call wrappers), `src/components/timer/useTimerSession.ts` (heartbeat loop, `sessionStorage` token, `BroadcastChannel` multi-tab sync, mount-time reconciliation), `RecoveryPrompt.tsx` for the RECOVERABLE state.
- [x] Phase 6 — Dashboard (`src/app/(app)/page.tsx` + `src/components/dashboard/*`): timer, today's goal, streak, weekly progress, record-chasing card, activity heatmap, analytics summary — in that priority order per spec §53.
- [x] Phase 7 — Manual time entry (`ManualTimeModal.tsx`, `src/server/actions/manual-entry.ts`), reachable from the dashboard and from each history row.
- [x] Phase 8 — History (`src/app/(app)/history/page.tsx`): filters via URL search params (bookmarkable, no client state needed), notes search, expandable rows with edit/delete for manual entries, and day-detail mode (`?date=`) with the chronological focus/break timeline.
- [x] Phase 9 — Goals (`src/app/(app)/goals/page.tsx`): daily/weekly/monthly minimum/target/stretch editors, long-term goal creation with live progress/pace/estimated-completion.
- [x] Phase 10 — Calendar heatmap (`StudyCalendarHeatmap.tsx`), GitHub-style, linking each day into History's day-detail view.
- [x] Phase 11 — Analytics (`src/app/(app)/analytics/page.tsx`): weekly/monthly/yearly breakdowns, category/skill distribution, the neglected-category note.
- [x] Phase 12 — Streaks and records: surfaced on the dashboard (streak, record-chasing) and folded into analytics; all computed live per `docs/database.md`.
- [x] Phase 13 — Notifications: real in-app browser Notifications (`GoalReminderNotifier.tsx`), scoped deliberately to "app open" rather than push/service-worker — see `architecture.md` §Notifications for why.
- [x] Phase 14 — Export/import (`ExportImportPanel.tsx`, `src/server/actions/export-import.ts`): JSON + CSV export, additive JSON import.
- [x] Phase 15 — Testing and edge cases: 105 Vitest tests (unit + integration against a disposable Postgres) plus a real-browser Playwright walk-through of the full timer → review → history flow (`scripts/e2e-smoke.mjs`) that caught and led to fixing a real duplicate-React-key bug in the heatmap before this was called done.
- [x] Phase 16 — UI polish and performance: design tokens (light/dark), responsive nav (top bar / bottom tabs), `error.tsx`/`loading.tsx`/`not-found.tsx` boundaries, keyboard shortcuts (Space/Enter), `prefers-reduced-motion` support.

Each phase was implemented, typechecked, linted, tested, and manually verified (in a real browser via Playwright, not just "it compiles") before being marked done here (spec §87).
