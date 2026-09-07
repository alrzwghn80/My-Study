import { formatDurationLong, formatTimeInZone } from "@/lib/format";

export function RecoveryPrompt({
  lastKnownGoodAt,
  gapSeconds,
  timezone,
  pending,
  onResume,
  onEnd,
}: {
  lastKnownGoodAt: Date;
  gapSeconds: number;
  timezone: string;
  pending: boolean;
  onResume: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-5">
      <h3 className="mb-1 text-sm font-semibold text-[var(--color-text)]">An unfinished session was detected</h3>
      <p className="mb-4 text-sm text-[var(--color-text-muted)]">
        Last activity was at {formatTimeInZone(lastKnownGoodAt, timezone)} — {formatDurationLong(gapSeconds)} ago.
        This can happen if your computer slept or the tab closed. Resuming will continue timing from now; ending
        the session credits time only up to that last activity.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onResume}
          disabled={pending}
          className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={onEnd}
          disabled={pending}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-60"
        >
          End Session at {formatTimeInZone(lastKnownGoodAt, timezone)}
        </button>
      </div>
    </div>
  );
}
