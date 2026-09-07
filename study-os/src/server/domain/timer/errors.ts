import type { SessionStatus } from "@/generated/prisma/enums";
import type { TimerEvent } from "./transitions";

/** Thrown by nextStatus() for any transition not in the table in transitions.ts. */
export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: SessionStatus,
    public readonly event: TimerEvent,
  ) {
    super(`Cannot apply ${event} to a session in ${from} state`);
    this.name = "InvalidTransitionError";
  }
}

/** A start was attempted while the user already has an ACTIVE/PAUSED session. */
export class SessionAlreadyActiveError extends Error {
  constructor(public readonly existingSessionId: string) {
    super("A session is already running for this user");
    this.name = "SessionAlreadyActiveError";
  }
}

/** activeToken on the request didn't match StudySession.activeToken — see architecture.md §Multi-tab safety. */
export class StaleControlTokenError extends Error {
  constructor(public readonly sessionId: string) {
    super("This tab no longer holds control of the session");
    this.name = "StaleControlTokenError";
  }
}

/** The referenced session doesn't exist, or doesn't belong to this user. */
export class SessionNotFoundError extends Error {
  constructor(public readonly sessionId: string) {
    super(`Session ${sessionId} not found`);
    this.name = "SessionNotFoundError";
  }
}
