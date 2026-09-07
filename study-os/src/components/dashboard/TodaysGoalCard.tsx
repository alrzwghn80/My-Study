import { Card, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDuration, formatPercent } from "@/lib/format";
import type { GoalSet } from "@/server/domain/goals";

export function TodaysGoalCard({
  focusSeconds,
  goals,
  completion,
}: {
  focusSeconds: number;
  goals: GoalSet;
  completion: { minimum: boolean; target: boolean; stretch: boolean };
}) {
  const primaryTarget = goals.target ?? goals.minimum ?? goals.stretch;

  if (!primaryTarget) {
    return (
      <Card>
        <CardTitle>Today&apos;s Goal</CardTitle>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          No daily target set yet. <a href="/goals" className="text-[var(--color-primary)] underline underline-offset-2">Set one in Goals</a>.
        </p>
        <p className="mt-2 font-metric text-lg text-[var(--color-text)]">{formatDuration(focusSeconds)} studied today</p>
      </Card>
    );
  }

  const fraction = focusSeconds / primaryTarget;
  const remaining = Math.max(0, primaryTarget - focusSeconds);

  return (
    <Card>
      <CardTitle>Today&apos;s Goal</CardTitle>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="font-metric text-2xl font-semibold text-[var(--color-text)]">
          {formatDuration(focusSeconds)} <span className="text-base font-normal text-[var(--color-text-muted)]">/ {formatDuration(primaryTarget)}</span>
        </span>
        <span className="font-metric text-sm text-[var(--color-text-muted)]">{formatPercent(Math.min(1, fraction))}</span>
      </div>
      <ProgressBar fraction={fraction} tone={completion.target ? "success" : "primary"} className="mt-3" />
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        {remaining > 0 ? `${formatDuration(remaining)} remaining` : "Target reached"}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        {(["minimum", "target", "stretch"] as const).map((level) =>
          goals[level] ? (
            <div key={level} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-2">
              <dt className="capitalize text-[var(--color-text-muted)]">{level}</dt>
              <dd className={`mt-0.5 font-medium ${completion[level] ? "text-[var(--color-success)]" : "text-[var(--color-text)]"}`}>
                {completion[level] ? "✓ " : ""}
                {formatDuration(goals[level]!)}
              </dd>
            </div>
          ) : null,
        )}
      </dl>
    </Card>
  );
}
