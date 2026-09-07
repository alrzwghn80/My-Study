import { SessionStatus } from "@/generated/prisma/enums";
import { InvalidTransitionError } from "./errors";

// IDLE and RECOVERABLE are not persisted SessionStatus values — IDLE is "no
// session exists" (no row to be in a state), and RECOVERABLE is a client-side
// UI state layered on top of ACTIVE/PAUSED (see recovery.ts and
// docs/timer-state-machine.md). START is likewise not a transition *out of*
// an existing status; it's session creation, handled by session-service.ts.
export type TimerEvent = "PAUSE" | "RESUME" | "COMPLETE" | "CANCEL";

type OpenStatus = typeof SessionStatus.ACTIVE | typeof SessionStatus.PAUSED;

const TRANSITIONS: Record<OpenStatus, Partial<Record<TimerEvent, SessionStatus>>> = {
  [SessionStatus.ACTIVE]: {
    PAUSE: SessionStatus.PAUSED,
    COMPLETE: SessionStatus.COMPLETED,
    CANCEL: SessionStatus.CANCELLED,
  },
  [SessionStatus.PAUSED]: {
    RESUME: SessionStatus.ACTIVE,
    COMPLETE: SessionStatus.COMPLETED,
    CANCEL: SessionStatus.CANCELLED,
  },
};

function isOpenStatus(status: SessionStatus): status is OpenStatus {
  return status === SessionStatus.ACTIVE || status === SessionStatus.PAUSED;
}

/**
 * The pure transition table from docs/timer-state-machine.md. Throws
 * InvalidTransitionError for anything not explicitly listed there —
 * including every transition out of a terminal COMPLETED/CANCELLED status.
 */
export function nextStatus(current: SessionStatus, event: TimerEvent): SessionStatus {
  if (!isOpenStatus(current)) {
    throw new InvalidTransitionError(current, event);
  }
  const next = TRANSITIONS[current][event];
  if (!next) {
    throw new InvalidTransitionError(current, event);
  }
  return next;
}
