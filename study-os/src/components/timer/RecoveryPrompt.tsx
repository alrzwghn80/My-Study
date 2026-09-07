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
    <div className="flex max-w-sm flex-col items-center gap-6 text-center">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-text)]">Still there?</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Your last activity was at {formatTimeInZone(lastKnownGoodAt, timezone)}, {formatDurationLong(gapSeconds)}{" "}
          ago — likely your computer slept or the tab closed.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onResume}
          disabled={pending}
          className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          Keep going
        </button>
        <button
          type="button"
          onClick={onEnd}
          disabled={pending}
          className="rounded-full px-6 py-2.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-60"
        >
          End at {formatTimeInZone(lastKnownGoodAt, timezone)}
        </button>
      </div>
    </div>
  );
}
