/**
 * The RECOVERABLE gate from docs/timer-state-machine.md: on any page load
 * that finds a session ACTIVE or PAUSED, decide whether a heartbeat gap is
 * large enough that the session's true end time is ambiguous.
 */

export const DEFAULT_STALE_THRESHOLD_SECONDS = 300; // 5 minutes, see timer-state-machine.md

export interface RecoveryCheckInput {
  /** Server clock at evaluation time. */
  now: Date;
  /** StudySession.lastHeartbeatAt — null if the session never received one (e.g. crashed before the first tick). */
  lastHeartbeatAt: Date | null;
  /** The currently-open interval's startedAt — the fallback "last known good" instant when there's no heartbeat at all. */
  openIntervalStartedAt: Date;
  staleThresholdSeconds?: number;
}

export type RecoveryCheckResult =
  | { stale: false }
  | { stale: true; lastKnownGoodAt: Date; gapSeconds: number };

export function evaluateRecovery(input: RecoveryCheckInput): RecoveryCheckResult {
  const threshold = input.staleThresholdSeconds ?? DEFAULT_STALE_THRESHOLD_SECONDS;
  const lastKnownGoodAt = input.lastHeartbeatAt ?? input.openIntervalStartedAt;
  const gapSeconds = Math.round((input.now.getTime() - lastKnownGoodAt.getTime()) / 1000);

  if (gapSeconds < threshold) {
    return { stale: false };
  }
  return { stale: true, lastKnownGoodAt, gapSeconds };
}
