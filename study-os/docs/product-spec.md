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
- [ ] Phase 3 — Session domain model
- [ ] Phase 4 — Timer state machine (implementation, per `timer-state-machine.md`)
- [ ] Phase 5 — Persistence and recovery
- [ ] Phase 6 — Dashboard
- [ ] Phase 7 — Manual time entry
- [ ] Phase 8 — History
- [ ] Phase 9 — Goals
- [ ] Phase 10 — Calendar heatmap
- [ ] Phase 11 — Analytics
- [ ] Phase 12 — Streaks and records
- [ ] Phase 13 — Notifications/reminders
- [ ] Phase 14 — Export/import
- [ ] Phase 15 — Testing and edge cases
- [ ] Phase 16 — UI polish and performance

Each phase is implemented, typechecked, linted, tested, and manually verified before the next begins (spec §87) — not accumulated unverified.
