"use client";

import { useTransition } from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDuration, formatLocalDate, formatPercent } from "@/lib/format";
import { archiveLongTermGoalAction } from "@/server/actions/goals";
import type { LongTermGoalProgress } from "@/server/domain/goals";

export function LongTermGoalCard({ goal }: { goal: LongTermGoalProgress }) {
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text)]">{goal.title}</h2>
        <button
          type="button"
          onClick={() => startTransition(() => void archiveLongTermGoalAction(goal.id))}
          disabled={pending}
          className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-danger)] disabled:opacity-60"
        >
          Archive
        </button>
      </div>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Target: {formatDuration(goal.targetSeconds)} {goal.targetDate ? `by ${formatLocalDate(goal.targetDate)}` : ""}
      </p>
      <ProgressBar fraction={goal.progress} tone={goal.progress >= 1 ? "success" : "primary"} className="mt-3" />
      <div className="mt-2 flex justify-between text-sm text-[var(--color-text-muted)]">
        <span>{formatDuration(goal.completedSeconds)} completed</span>
        <span>{formatPercent(goal.progress)}</span>
      </div>
      {goal.requiredDailyPaceSeconds !== null && (
        <p className="mt-2 text-xs text-[var(--color-text-faint)]">
          Requires ~{formatDuration(goal.requiredDailyPaceSeconds)}/day to hit your target date.
        </p>
      )}
      {goal.estimatedCompletionDate && goal.progress < 1 && (
        <p className="mt-1 text-xs text-[var(--color-text-faint)]">
          Estimated completion at current pace: {formatLocalDate(goal.estimatedCompletionDate)}
        </p>
      )}
    </Card>
  );
}
