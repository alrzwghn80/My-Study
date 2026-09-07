# Timer State Machine

## States

```
IDLE          No session in progress. Start button is the only action.
RUNNING       An open FOCUS interval exists. Maps to StudySession.status = ACTIVE.
PAUSED        An open BREAK interval exists. Same session, same id.
COMPLETED     Terminal. Session finalized, counts toward every statistic.
CANCELLED     Terminal. Session finalized, counts toward NOTHING.
RECOVERABLE   A session was found ACTIVE or PAUSED on load, with a heartbeat
              gap large enough that its true end time is ambiguous. Not a
              StudySession.status value — a client-side UI state that gates
              showing the recovery prompt instead of the normal timer.
```

## Transition table

| From | Event | To | Server-side effect |
|---|---|---|---|
| IDLE | Start | RUNNING | Create `StudySession{status: ACTIVE, source: TRACKED}` + `SESSION_CREATED`, `SESSION_STARTED` events. Open a `FOCUS` interval (`startedAt = now`). Issue a fresh `activeToken`. |
| RUNNING | Pause | PAUSED | Close the open FOCUS interval (`endedAt = now`, split at local-midnight if it crossed one — see `database.md`). Open a `BREAK` interval. Emit `SESSION_PAUSED`. **Session id is unchanged.** |
| PAUSED | Resume | RUNNING | Close the open BREAK interval. Open a new FOCUS interval. Emit `SESSION_RESUMED`. Session id unchanged. |
| RUNNING | Complete | COMPLETED | Close the open FOCUS interval. Set `completedAt = now`, `status = COMPLETED`. Emit `SESSION_COMPLETED`. Open the review modal (category/rating/notes). |
| PAUSED | Complete | COMPLETED | Close the open BREAK interval (break time already recorded counts as break, not focus — see Data Definitions). Same as above otherwise. |
| RUNNING | Cancel | CANCELLED | **Discard the entire session**: delete its `SessionInterval` rows outright (not a soft-exclude flag), set `status = CANCELLED`, zero the denormalized totals. Emit `SESSION_CANCELLED` — the event log entry (and the fact a session existed) is kept for audit purposes even though its intervals are gone. Counts toward nothing. |
| PAUSED | Cancel | CANCELLED | Same as above. |
| IDLE | Add manual time | (no state change) | Creates a separate `StudySession{source: MANUAL, status: COMPLETED}` with one FOCUS interval spanning the given duration. Does not touch the timer state machine at all — manual entry is orthogonal to RUNNING/PAUSED. |
| RUNNING/PAUSED (on page load) | Heartbeat gap > threshold | RECOVERABLE | No server mutation yet. Client shows: "Last activity at HH:MM — Resume / End Session". |
| RECOVERABLE | Resume | RUNNING or PAUSED (whichever it was) | The open interval's `endedAt` is *not* backdated — the interval simply continues from where the server left it. The gap itself is not counted as focus or break time either way; it just wasn't closed yet. |
| RECOVERABLE | End Session | COMPLETED | The open interval is closed at `lastHeartbeatAt`, **not** at `now` — see policy below. |

### Invalid transitions (rejected, not silently coerced)

- Start while RUNNING/PAUSED already exists for this user → rejected by the app layer (session already found) and, as a backstop, by the DB partial unique index. Response: "A session is already running" — the client is redirected to show that session, never allowed to create a second one.
- Pause/Resume/Complete/Cancel with a stale or missing `activeToken` → rejected, no mutation. This is the multi-tab guard (`architecture.md`).
- Resume on a COMPLETED or CANCELLED session → rejected; those are terminal.
- Complete or Cancel on IDLE (no session) → rejected; nothing to act on.
- Double-submit (rapid double-click Start) → the second request either finds the first one already created the session (returns the existing session, no duplicate) or hits the unique index and is rejected the same way as any other concurrent-start race.

## Decision: Cancel discards the whole session

The spec (§8) requires that Cancel "must NOT silently count the entire elapsed wall-clock period as study time." Because focus time is never computed as `end - start` (§9) but summed from real closed intervals, that specific failure mode is already impossible regardless of what Cancel does. That still leaves a real design choice: **should Cancel keep the focus time that was already accrued before the cancel, or void the whole session?**

**Decision: void the whole session — Cancel counts toward nothing, at any point in the session.** Rationale:
- It gives Start/Pause/Resume/**Complete**/**Cancel** an unambiguous split: *Complete* means "finalize and keep whatever real focus time happened, even if short" (a 4-minute completed session is legitimate and countable); *Cancel* means "this didn't happen, undo it." Without this split, Cancel would just be a worse, harder-to-reason-about version of Complete.
- It matches the plain-language meaning of "cancel" better than a version that keeps partial credit — a user hitting Cancel is saying "I didn't mean to start this," not "stop here but still count it."
- If the real intent is "I studied 12 minutes then got interrupted and won't finish," the correct action is **Complete**, not Cancel — the UI should make Complete easy to reach from PAUSED for exactly this case, rather than users reaching for Cancel to end a real (if short) session.

This is called out per spec §95 as a judgment call the spec left implicit, not a deviation from an explicit requirement.

## Recovery / long-gap policy (sleep, closed laptop, crashed tab)

A heartbeat (`updateHeartbeat` Server Action) fires every 20 seconds while RUNNING, updating `StudySession.lastHeartbeatAt`. On any page load that finds a session ACTIVE or PAUSED:

- `now - lastHeartbeatAt < 5 minutes` → treat as a normal refresh. Resume the live display seamlessly; no prompt.
- `now - lastHeartbeatAt >= 5 minutes` → enter RECOVERABLE. Show: *"Last activity at HH:MM. This may be from your computer sleeping or the tab closing. [Resume] [End Session at HH:MM]"*.
  - **Resume** leaves the interval open and continuing from now — the gap is simply unaccounted-for time, credited as neither focus nor break, because we have no evidence the user was studying during it. (This is deliberately conservative — see spec §9/§32: "do not assume the user was actively studying while the computer was asleep.")
  - **End Session** closes the interval at `lastHeartbeatAt` (the last moment we have positive evidence of activity), then proceeds to COMPLETED and the normal review flow. The gap itself is excluded from `focusSeconds` by construction, since the interval's `endedAt` is the heartbeat time, not `now`.

5 minutes is a `Settings`-adjustable threshold in a future settings pass; hardcoded for the initial implementation with the rationale documented here so it's easy to find and change.

## Data definitions (see also `database.md`, `analytics.md`)

- **Focus time**: sum of `durationSeconds` over `SessionInterval{type: FOCUS}` rows only.
- **Break time**: sum over `SessionInterval{type: BREAK}` rows. Never counted as study time anywhere.
- **Elapsed time**: focus + break for a given session — shown for context (e.g. "session lasted 1h 40m, of which 1h 30m was focus"), never used as the study-time metric itself.
- **Session duration** (unqualified): focus time, per spec §57.
