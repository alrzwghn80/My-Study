"use client";

import { useEffect, useState } from "react";
import { formatClock, formatDuration, formatDurationLong } from "@/lib/format";
import { useTimerSession } from "./useTimerSession";
import { RecoveryPrompt } from "./RecoveryPrompt";
import type { ActiveSessionData } from "./types";

const EXIT_ANIMATION_MS = 250;
const COMPLETION_DISPLAY_MS = 1400;

export function StudyTimer({
  initialSession,
  timezone,
  todayFocusSeconds,
}: {
  initialSession: ActiveSessionData | null;
  timezone: string;
  todayFocusSeconds: number;
}) {
  const timer = useTimerSession(initialSession);

  const isFocused = timer.state.kind === "controlling" || timer.state.kind === "read-only" || timer.state.kind === "recoverable";
  const showOverlay = isFocused || !!timer.lastCompleted;

  const [mountedOverlay, setMountedOverlay] = useState(showOverlay);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // Drives the enter/exit CSS transition off showOverlay changing — the
    // canonical "synchronize with an external animation" effect use case.
    if (showOverlay) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMountedOverlay(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const t = setTimeout(() => setMountedOverlay(false), EXIT_ANIMATION_MS);
    return () => clearTimeout(t);
  }, [showOverlay]);

  // Auto-dismiss the brief completion confirmation.
  useEffect(() => {
    if (!timer.lastCompleted) return;
    const t = setTimeout(() => timer.clearLastCompleted(), COMPLETION_DISPLAY_MS);
    return () => clearTimeout(t);
  }, [timer, timer.lastCompleted]);

  // Keyboard shortcuts: Space = start/pause/resume, Enter = resume, Esc = discard (while focused).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isFormControl = target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName);
      if (isFormControl || timer.lastCompleted || timer.pending) return;

      if (e.code === "Space" && timer.state.kind === "controlling") {
        e.preventDefault();
        if (timer.state.session.status === "ACTIVE") void timer.pause();
        else void timer.resume();
      } else if (e.code === "Space" && timer.state.kind === "idle") {
        e.preventDefault();
        void timer.start(null);
      } else if (e.key === "Enter" && timer.state.kind === "controlling" && timer.state.session.status === "PAUSED") {
        e.preventDefault();
        void timer.resume();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [timer]);

  return (
    <>
      <div className="flex flex-col items-center gap-5 py-10 text-center sm:py-16">
        <p className="text-sm text-[var(--color-text-muted)]">
          {todayFocusSeconds > 0 ? `${formatDuration(todayFocusSeconds)} today` : "Nothing studied yet today"}
        </p>
        <button
          type="button"
          onClick={() => void timer.start(null)}
          className="rounded-full bg-[var(--color-primary)] px-10 py-5 text-lg font-semibold text-[var(--color-primary-fg)] shadow-[var(--shadow-md)] transition-transform duration-150 hover:scale-[1.03] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] motion-reduce:transition-none"
        >
          Start studying
        </button>
      </div>

      {mountedOverlay && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-bg)] px-6 transition-all duration-300 ease-out motion-reduce:transition-none ${
            entered ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className={`flex w-full max-w-md flex-col items-center transition-transform duration-300 ease-out motion-reduce:transition-none ${
              entered ? "scale-100" : "scale-95"
            }`}
          >
            {timer.lastCompleted ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-4xl">✓</p>
                <p className="font-metric text-2xl text-[var(--color-text)]">
                  {formatDurationLong(timer.lastCompleted.focusSeconds)} recorded
                </p>
              </div>
            ) : timer.state.kind === "recoverable" ? (
              <RecoveryPrompt
                lastKnownGoodAt={timer.state.lastKnownGoodAt}
                gapSeconds={timer.state.gapSeconds}
                timezone={timezone}
                pending={timer.pending}
                onResume={() => void timer.recoverResume()}
                onEnd={() => void timer.recoverEnd()}
              />
            ) : timer.state.kind === "read-only" ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">Studying in another tab</p>
                <button
                  type="button"
                  onClick={() => void timer.claim()}
                  disabled={timer.pending}
                  className="rounded-full border border-[var(--color-border-strong)] px-6 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-60"
                >
                  Continue here
                </button>
              </div>
            ) : timer.state.kind === "controlling" ? (
              <>
                <p className="mb-2 text-sm uppercase tracking-wide text-[var(--color-text-faint)]">
                  {timer.state.session.status === "PAUSED" ? "Paused" : "Studying"}
                </p>
                <div className="font-metric text-7xl font-semibold text-[var(--color-text)] sm:text-8xl" aria-live="polite">
                  {formatClock(timer.displaySeconds)}
                </div>

                {timer.error && (
                  <p role="alert" className="mt-4 text-sm text-[var(--color-danger)]">
                    {timer.error}
                  </p>
                )}

                <div className="mt-10 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => (timer.state.kind === "controlling" && timer.state.session.status === "ACTIVE" ? void timer.pause() : void timer.resume())}
                    disabled={timer.pending}
                    className="rounded-full border border-[var(--color-border-strong)] px-7 py-3 text-base font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-60"
                  >
                    {timer.state.session.status === "ACTIVE" ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void timer.complete()}
                    disabled={timer.pending}
                    className="rounded-full bg-[var(--color-primary)] px-7 py-3 text-base font-semibold text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                  >
                    Finish
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Discard this session? No time will be recorded.")) void timer.cancel();
                  }}
                  disabled={timer.pending}
                  className="mt-8 text-xs text-[var(--color-text-faint)] hover:text-[var(--color-danger)] disabled:opacity-60"
                >
                  Discard session
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
