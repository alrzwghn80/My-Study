# Architecture

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | One codebase for server-rendered pages, API-less mutations (Server Actions), and the client-side timer. No separate backend to deploy on the VPS. |
| Language | TypeScript, strict mode | Domain logic (timer FSM, analytics formulas) is exactly the kind of code that benefits from a type checker catching a wrong enum value or unit mismatch. |
| Database | PostgreSQL | Partial unique indexes (used to enforce "one active session per user" at the DB level, not just in app code), real `DATE` type for calendar-day aggregation, solid transaction guarantees. |
| ORM | Prisma 7 | Schema-as-source-of-truth migrations (§90 of the spec — never hand-mutate schema). Prisma 7 requires an explicit driver adapter (`@prisma/adapter-pg`) rather than a bare connection string — see `prisma.config.ts` vs `src/server/db/client.ts`. |
| Auth | Credentials (email + password) via NextAuth, JWT session strategy | Single private user (spec §35) — no OAuth, no multi-tenant tables. JWT strategy means no `Session`/`Account` tables are needed at all. |
| Styling | Tailwind CSS v4 | Design tokens (spec §50/§76) as CSS variables, utility classes for layout. |
| Testing | Vitest + Testing Library | Fast, ESM-native, works with the App Router without a separate config for server vs. client code. |

Rejected: a separate Express/Fastify backend (unnecessary — Server Actions and Route Handlers cover every case in §60); an ORM without adapter-based migrations (violates §90); client-side-only persistence such as IndexedDB as the primary store (explicitly forbidden by §70/§71).

## Project structure

```
study-os/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── prisma.config.ts        # Migrate CLI's connection config (not read at runtime)
├── src/
│   ├── app/                 # Routes: study (/), history, settings — see docs/product-spec.md §UI Redesign
│   ├── server/
│   │   ├── db/client.ts     # PrismaClient singleton, wired with the pg driver adapter
│   │   ├── domain/          # Pure logic: timer FSM, streaks, records, analytics formulas (some now UI-unused, kept — see product-spec.md)
│   │   ├── actions/         # Server Actions — the only way the client mutates data
│   │   └── auth.ts          # NextAuth config
│   ├── components/          # React components, organized by feature not by type
│   ├── lib/                 # Shared client-safe utilities (time formatting, etc.)
│   └── generated/prisma/    # Generated client output — never edited, gitignored
└── docs/
```

## Client/server boundary

- **Server owns every timestamp that becomes historical fact.** `SessionEvent.occurredAt` and every `SessionInterval` boundary are set by the server clock, inside the Server Action that handles the action — never taken from a client-supplied value. See §Clock changes in `timer-state-machine.md`.
- **The client owns only the live countdown display.** The running timer's on-screen number is computed client-side from `serverStartedAt + (Date.now() - clientClockOffset)`, purely for a smooth per-second UI update; it is never sent back to the server as data.
- **All persistence goes through Server Actions** (`src/server/actions/`), not Route Handlers or client-side fetches to an API — this keeps validation in one place per action and avoids duplicating business logic between an API layer and a forms layer (spec §61/§62).
- **Domain logic lives in `src/server/domain/`, not in components.** A Server Action calling `startSession(userId)` should be a thin wrapper: auth check → call domain function → return result. The domain function is unit-testable without spinning up Next.js.

## Timer architecture

The visible timer is a **thin, isolated client component** (`<StudyTimer />`) that:
1. Receives the current session's server state (status, `startedAt` of the open interval, accumulated seconds) as props from a Server Component.
2. Runs a local `requestAnimationFrame`/1s-interval loop purely to re-render its own display — no other component subscribes to this tick, so the rest of the dashboard does not re-render every second (spec §73).
3. Sends a lightweight heartbeat (`updateHeartbeat` Server Action) every 20 seconds while RUNNING, updating `StudySession.lastHeartbeatAt`. This is the mechanism recovery uses to detect a stale/crashed session — see `timer-state-machine.md`.
4. On mount, reconciles against the server: if a heartbeat gap is detected, it does not silently resume — it surfaces the recovery prompt.

## Multi-tab safety

`startSession` issues a fresh random `activeToken`, stored on `StudySession.activeToken` and returned to the calling tab only. The tab persists it in `sessionStorage` (keyed by session id) — **not** `localStorage`. This distinction is deliberate and does real work: `sessionStorage` is scoped to a single tab but, unlike a React-state-only token, survives that same tab reloading, which is what lets the tab that's actually driving a session refresh the page without losing control of it. A newly opened tab starts with empty `sessionStorage` regardless of what's running elsewhere, so it never inherits control it shouldn't have. Every subsequent `pause`/`resume`/`complete`/`cancel`/heartbeat call includes the token; the server rejects the call (without mutating anything) if it doesn't match the session's current token.

Other tabs — and the controlling tab's own first render after a reload before it's checked `sessionStorage` — are read-only observers: they poll session state via a `BroadcastChannel` message that the owning tab posts on every state change (start/pause/resume/complete), and render "Session running elsewhere — view only, [Take control here]" if they don't hold the matching token. "Take control" calls `claimSession`, which reissues a new `activeToken` (invalidating whichever tab held the old one) — an explicit, user-initiated action, never automatic, so opening a second tab never silently steals control out from under the first. This is what prevents `Tab A = RUNNING, Tab B = RUNNING` (spec §65).

The database-level partial unique index (`one_active_or_paused_session_per_user`, see `prisma/migrations/`) is the actual backstop: even if two requests somehow race past the token check, only one `INSERT`/`UPDATE` into an ACTIVE/PAUSED status can ever succeed for a given user. The loser gets a constraint-violation error, which the Server Action turns into "a session is already running" rather than a 500.

## System clock changes

Every authoritative duration is computed from **server-generated timestamps** written inside a database transaction at the moment a Server Action runs (`occurredAt: new Date()` on the server, `SessionInterval.startedAt`/`endedAt` from the server clock). A client's system clock being wrong, changed, or drifting during a session has **zero effect on stored data** — it can only make the live countdown display momentarily inaccurate until the next heartbeat reconciles it. This is why the client never sends a timestamp that gets persisted as-is; `clientTimestamp` on `SessionEvent` is stored for debugging only and is explicitly excluded from every calculation (see `analytics.md`).

## Recovery strategy (refresh / close / sleep / network loss)

See `timer-state-machine.md` for the full RECOVERABLE state and heartbeat-staleness policy. Summary: a session's server-side state (status + open interval + `lastHeartbeatAt`) is the only thing that matters. The client holds no state that isn't reconstructible from a fresh page load — a refresh just re-fetches the session and re-renders whatever state it finds. A long gap since the last heartbeat (default threshold: 5 minutes) never gets silently credited as focus time; the user is always shown what happened and asked to confirm before it's finalized.

## Offline behavior

The live clock never depends on the network — it's derived from the last server-confirmed timestamp plus `Date.now()` (see §Timer architecture above), so a temporary connection loss doesn't freeze or corrupt the on-screen display. What *does* need the network is any control action (pause/resume/complete/cancel/heartbeat): `useTimerSession`'s action runner (`src/components/timer/useTimerSession.ts`) catches a failed request and shows "Couldn't reach the server — your session is unaffected, try again" rather than letting it fail silently or resetting the UI to idle. It deliberately does **not** reset local state or attempt to reconcile against the server on this path — there's no fresh server truth to reconcile against while offline, and dropping back to "idle" would be a worse failure mode than just leaving the last-known state on screen until the user retries. Every action is safe to retry as-is: the `activeToken` check and the FSM's transition table (`timer-state-machine.md`) together mean a retried action either applies once or is cleanly rejected as invalid — never double-applied.

This is a narrower guarantee than a queued-and-auto-replayed offline mode (spec §69's "if practical") — no background retry, no service worker, no local mirror of pending actions. That scope was judged disproportionate for a private single-user app measured against the cost of building and testing a background sync queue correctly; the chosen behavior still satisfies §69's actual requirements — the timer stays usable and legible while offline, and reconnecting never creates a duplicate session or double-counts time — through the always-idempotent action design rather than through queuing.

## Notifications

Same scope call as offline support: `GoalReminderNotifier` (`src/components/dashboard/GoalReminderNotifier.tsx`) is a real, working browser Notification (not a stub) — it fires once per calendar day, only while the dashboard is open, if the user has enabled notifications (Settings → Timer) and granted the browser permission, and today's target isn't met yet. There is no service worker and no push subscription, so it cannot notify while the app/tab is closed — spec §44's examples ("you haven't reached today's goal," "weekly goal 87% complete") are satisfied for "the app is open and you haven't looked at it in a while," not for a closed-tab reminder. A closed-tab push notification would need a service worker, a push subscription, and a server-side scheduler deciding when to send — real infrastructure judged disproportionate to build for a private single-user app in this pass. The toggle and the in-app version are both genuinely functional today; a push-based version is the natural next increment if it's ever wanted.
