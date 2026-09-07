import { Card, CardTitle } from "@/components/ui/Card";
import { formatDuration, formatLocalDate, formatTimeInZone } from "@/lib/format";
import type { IntervalType } from "@/generated/prisma/enums";

export interface DayIntervalData {
  id: string;
  type: IntervalType;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
}

export function DayDetailTimeline({
  date,
  timezone,
  focusSeconds,
  breakSeconds,
  intervals,
  sessionCount,
}: {
  date: Date;
  timezone: string;
  focusSeconds: number;
  breakSeconds: number;
  intervals: DayIntervalData[];
  sessionCount: number;
}) {
  return (
    <Card>
      <CardTitle>{formatLocalDate(date)}</CardTitle>
      <div className="mt-3 flex gap-6">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Total Study</p>
          <p className="font-metric text-lg font-medium text-[var(--color-text)]">{formatDuration(focusSeconds)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Break</p>
          <p className="font-metric text-lg font-medium text-[var(--color-text)]">{formatDuration(breakSeconds)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Sessions</p>
          <p className="font-metric text-lg font-medium text-[var(--color-text)]">{sessionCount}</p>
        </div>
      </div>

      {intervals.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">No recorded time on this day.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2">
          {intervals.map((iv) => (
            <li key={iv.id} className="flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 font-metric text-[var(--color-text-muted)]">
                {formatTimeInZone(iv.startedAt, timezone)}
              </span>
              <span
                className={`h-1.5 flex-1 rounded-full ${iv.type === "FOCUS" ? "bg-[var(--color-primary)]" : "bg-[var(--color-border-strong)]"}`}
              />
              <span className="w-12 shrink-0 text-right font-metric text-[var(--color-text-muted)]">
                {iv.endedAt ? formatTimeInZone(iv.endedAt, timezone) : "…"}
              </span>
              <span className="w-16 shrink-0 text-xs uppercase text-[var(--color-text-faint)]">{iv.type}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
