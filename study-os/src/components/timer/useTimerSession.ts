"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelSessionAction,
  claimSessionAction,
  completeSessionAction,
  getRecoveryStatusAction,
  heartbeatAction,
  pauseSessionAction,
  recoverEndAction,
  recoverResumeAction,
  resumeSessionAction,
  startSessionAction,
} from "@/server/actions/timer";
import type { ActiveSessionData } from "./types";

const HEARTBEAT_INTERVAL_MS = 20_000;
const TICK_INTERVAL_MS = 1000;
const BROADCAST_CHANNEL_NAME = "study-os-timer";

function tokenStorageKey(sessionId: string) {
  return `study-os:session-token:${sessionId}`;
}

function readStoredToken(sessionId: string): string | null {
  try {
    return sessionStorage.getItem(tokenStorageKey(sessionId));
  } catch {
    return null;
  }
}

function storeToken(sessionId: string, token: string) {
  try {
    sessionStorage.setItem(tokenStorageKey(sessionId), token);
  } catch {
    // Private browsing / storage blocked — control still works for this
    // page load, it just won't survive a refresh. Non-fatal.
  }
}

export type ControlState =
  | { kind: "loading" }
  | { kind: "idle" }
  | { kind: "read-only"; session: ActiveSessionData }
  | {
      kind: "recoverable";
      session: ActiveSessionData;
      token: string;
      lastKnownGoodAt: Date;
      gapSeconds: number;
    }
  | { kind: "controlling"; session: ActiveSessionData; token: string };

export interface UseTimerSessionResult {
  state: ControlState;
  displaySeconds: number;
  error: string | null;
  pending: boolean;
  lastCompleted: { sessionId: string; focusSeconds: number } | null;
  clearLastCompleted: () => void;
  start: (categoryId: string | null) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  complete: () => Promise<void>;
  cancel: () => Promise<void>;
  claim: () => Promise<void>;
  recoverResume: () => Promise<void>;
  recoverEnd: () => Promise<void>;
}

export function useTimerSession(initial: ActiveSessionData | null): UseTimerSessionResult {
  // Seed with the server-rendered snapshot so first paint isn't blank; the
  // mount-time reconcile() below is what actually determines control
  // (sessionStorage only exists client-side) and corrects this if stale.
  const [state, setState] = useState<ControlState>(() =>
    initial ? { kind: "read-only", session: initial } : { kind: "idle" },
  );
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [lastCompleted, setLastCompleted] = useState<{ sessionId: string; focusSeconds: number } | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const reconcile = useCallback(async () => {
    const result = await getRecoveryStatusAction();
    if (!result.ok) {
      setError(result.error);
      setState({ kind: "idle" });
      return;
    }
    if (!result.data) {
      setState({ kind: "idle" });
      return;
    }

    const { session, recovery } = result.data;
    const stored = readStoredToken(session.id);

    if (!stored) {
      setState({ kind: "read-only", session });
      return;
    }
    if (recovery.stale) {
      setState({
        kind: "recoverable",
        session,
        token: stored,
        lastKnownGoodAt: recovery.lastKnownGoodAt,
        gapSeconds: recovery.gapSeconds,
      });
      return;
    }
    setState({ kind: "controlling", session, token: stored });
  }, []);

  // Initial mount: reconcile against the server rather than trusting the
  // server-rendered prop as final — see docs/architecture.md §Recovery strategy.
  // This is React's own documented "fetch on mount" pattern (an async
  // function whose setState calls all happen after an await, never
  // synchronously within this effect's own execution) — the lint rule can't
  // see across that async boundary from a named function reference.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reconcile();
  }, [reconcile]);

  // Multi-tab sync: any tab's state-changing action posts here; every tab reconciles.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current = channel;
    channel.onmessage = () => void reconcile();
    return () => channel.close();
  }, [reconcile]);

  const broadcast = useCallback(() => {
    channelRef.current?.postMessage({ type: "changed" });
  }, []);

  // Heartbeat while controlling a live session (either ACTIVE or PAUSED —
  // staleness detection works the same regardless of which).
  useEffect(() => {
    if (state.kind !== "controlling") return;
    const { session, token } = state;
    const id = setInterval(() => {
      void heartbeatAction(session.id, token);
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [state]);

  // Live display tick — always derived from persisted timestamps + now,
  // never incremented, per docs/timer-state-machine.md §Timer accuracy.
  // `tickSeconds` only ever holds a value while there's a session to show;
  // the "nothing to show" case is a render-time ternary below rather than a
  // reset inside the effect, so the effect never setState()s synchronously
  // outside its own subscription callback.
  useEffect(() => {
    if (state.kind !== "controlling" && state.kind !== "read-only") return;
    const session = state.session;
    const openInterval = session.intervals[0];

    const compute = () => {
      if (session.status === "ACTIVE" && openInterval) {
        const liveSeconds = (Date.now() - openInterval.startedAt.getTime()) / 1000;
        setDisplaySeconds(session.focusSeconds + Math.max(0, liveSeconds));
      } else {
        setDisplaySeconds(session.focusSeconds);
      }
    };
    compute();
    const id = setInterval(compute, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [state]);

  const run = useCallback(
    async <T,>(action: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, after?: (data: T) => void) => {
      setPending(true);
      setError(null);
      try {
        const result = await action();
        if (!result.ok) {
          setError(result.error);
          await reconcile(); // our local guess may be stale — resync
          return;
        }
        after?.(result.data);
        broadcast();
        await reconcile();
      } catch {
        // The request itself failed (offline / connection lost) rather than
        // the server returning a handled error — see docs/architecture.md
        // §Offline behavior. Deliberately does NOT reconcile here: we have
        // no fresh server truth to reconcile against, and resetting to
        // "idle" would be worse than just leaving the last-known state on
        // screen. The live clock keeps ticking regardless (it's derived
        // from timestamps, not the network) — only control actions are
        // affected, and the user can just retry once back online.
        setError("Couldn't reach the server. Your session is unaffected — check your connection and try again.");
      } finally {
        setPending(false);
      }
    },
    [reconcile, broadcast],
  );

  const start = useCallback(
    (categoryId: string | null) =>
      run(() => startSessionAction(categoryId), (data) => storeToken(data.sessionId, data.activeToken)),
    [run],
  );

  const pause = useCallback(() => {
    if (state.kind !== "controlling") return Promise.resolve();
    return run(() => pauseSessionAction(state.session.id, state.token));
  }, [run, state]);

  const resume = useCallback(() => {
    if (state.kind !== "controlling") return Promise.resolve();
    return run(() => resumeSessionAction(state.session.id, state.token));
  }, [run, state]);

  const complete = useCallback(() => {
    if (state.kind !== "controlling") return Promise.resolve();
    return run(
      () => completeSessionAction(state.session.id, state.token),
      (data) => setLastCompleted(data),
    );
  }, [run, state]);

  const cancel = useCallback(() => {
    if (state.kind !== "controlling") return Promise.resolve();
    return run(() => cancelSessionAction(state.session.id, state.token));
  }, [run, state]);

  const claim = useCallback(() => {
    if (state.kind !== "read-only") return Promise.resolve();
    const sessionId = state.session.id;
    return run(() => claimSessionAction(sessionId), (data) => storeToken(sessionId, data.activeToken));
  }, [run, state]);

  const recoverResume = useCallback(() => {
    if (state.kind !== "recoverable") return Promise.resolve();
    return run(() => recoverResumeAction(state.session.id, state.token));
  }, [run, state]);

  const recoverEnd = useCallback(() => {
    if (state.kind !== "recoverable") return Promise.resolve();
    return run(
      () => recoverEndAction(state.session.id, state.token, state.lastKnownGoodAt.toISOString()),
      (data) => setLastCompleted(data),
    );
  }, [run, state]);

  const shownDisplaySeconds = state.kind === "controlling" || state.kind === "read-only" ? displaySeconds : 0;

  return {
    state,
    displaySeconds: shownDisplaySeconds,
    error,
    pending,
    lastCompleted,
    clearLastCompleted: () => setLastCompleted(null),
    start,
    pause,
    resume,
    complete,
    cancel,
    claim,
    recoverResume,
    recoverEnd,
  };
}
