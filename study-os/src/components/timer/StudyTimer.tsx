"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/format";
import { useTimerSession } from "./useTimerSession";
import { CategorySelect } from "./CategorySelect";
import { RecoveryPrompt } from "./RecoveryPrompt";
import { SessionReviewModal } from "./SessionReviewModal";
import type { ActiveSessionData, CategoryOption } from "./types";

export function StudyTimer({
  initialSession,
  categories,
  timezone,
}: {
  initialSession: ActiveSessionData | null;
  categories: CategoryOption[];
  timezone: string;
}) {
  const timer = useTimerSession(initialSession);
  const [startCategoryId, setStartCategoryId] = useState("");

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? null;

  // Keyboard shortcuts (spec §46): Space = start/pause, Enter = resume.
  // Ignored while focus is in a form control or a modal is open, so they
  // never fight with typing in the review/manual-entry forms.
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
        void timer.start(startCategoryId || null);
      } else if (
        e.key === "Enter" &&
        timer.state.kind === "controlling" &&
        timer.state.session.status === "PAUSED"
      ) {
        e.preventDefault();
        void timer.resume();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [timer, startCategoryId]);

  return (
    <div className="flex flex-col items-center gap-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-sm)] md:p-10">
      {timer.state.kind === "recoverable" && (
        <div className="w-full">
          <RecoveryPrompt
            lastKnownGoodAt={timer.state.lastKnownGoodAt}
            gapSeconds={timer.state.gapSeconds}
            timezone={timezone}
            pending={timer.pending}
            onResume={() => void timer.recoverResume()}
            onEnd={() => void timer.recoverEnd()}
          />
        </div>
      )}

      {timer.state.kind === "read-only" && (
        <div className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm text-[var(--color-text-muted)]">
          A session is running elsewhere.{" "}
          <button
            type="button"
            onClick={() => void timer.claim()}
            disabled={timer.pending}
            className="font-medium text-[var(--color-primary)] underline underline-offset-2 disabled:opacity-60"
          >
            Take control here
          </button>
        </div>
      )}

      {(timer.state.kind === "controlling" || timer.state.kind === "read-only") && (
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          {timer.state.session.status === "PAUSED" ? "On break" : "Focus"}
          {categoryName(timer.state.session.categoryId) ? ` · ${categoryName(timer.state.session.categoryId)}` : ""}
        </p>
      )}

      <div
        className="font-metric text-6xl font-semibold text-[var(--color-text)] md:text-7xl"
        aria-live="polite"
        aria-label={`Session timer: ${formatClock(timer.displaySeconds)}`}
      >
        {formatClock(timer.displaySeconds)}
      </div>

      {timer.error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {timer.error}
        </p>
      )}

      {timer.state.kind === "idle" && (
        <div className="flex w-full max-w-xs flex-col items-center gap-4">
          <div className="w-full">
            <CategorySelect
              id="start-category"
              name="categoryId"
              categories={categories}
              value={startCategoryId}
              onChange={setStartCategoryId}
              label="What are you studying?"
            />
          </div>
          <button
            type="button"
            onClick={() => void timer.start(startCategoryId || null)}
            disabled={timer.pending}
            className="w-full rounded-[var(--radius-md)] bg-[var(--color-primary)] px-6 py-3 text-base font-semibold text-[var(--color-primary-fg)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            Start Studying
          </button>
        </div>
      )}

      {timer.state.kind === "controlling" && (
        <div className="flex w-full max-w-xs flex-wrap justify-center gap-2">
          {timer.state.session.status === "ACTIVE" ? (
            <button
              type="button"
              onClick={() => void timer.pause()}
              disabled={timer.pending}
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-60"
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void timer.resume()}
              disabled={timer.pending}
              className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] px-5 py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-60"
            >
              Resume
            </button>
          )}
          <button
            type="button"
            onClick={() => void timer.complete()}
            disabled={timer.pending}
            className="flex-1 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            Complete
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Cancel this session? None of its time will be recorded.")) void timer.cancel();
            }}
            disabled={timer.pending}
            className="w-full rounded-[var(--radius-md)] px-5 py-2 text-xs font-medium text-[var(--color-text-faint)] hover:text-[var(--color-danger)] disabled:opacity-60"
          >
            Cancel session
          </button>
        </div>
      )}

      {timer.lastCompleted && (
        <SessionReviewModal
          sessionId={timer.lastCompleted.sessionId}
          focusSeconds={timer.lastCompleted.focusSeconds}
          categories={categories}
          onClose={timer.clearLastCompleted}
        />
      )}
    </div>
  );
}
