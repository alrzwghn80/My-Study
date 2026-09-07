import { Card, CardTitle } from "@/components/ui/Card";
import { formatDuration, formatSignedPercent, formatWeekday } from "@/lib/format";
import { addDays } from "@/server/domain/calendar";
import { percentChange, type DailyTotal } from "@/server/domain/analytics";

export function WeeklyProgressCard({
  weekStart,
  thisWeekSeconds,
  lastWeekSeconds,
  totals,
}: {
  weekStart: Date;
  thisWeekSeconds: number;
  lastWeekSeconds: number;
  totals: DailyTotal[];
}) {
  const byDate = new Map(totals.map((t) => [t.date.getTime(), t.focusSeconds]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, seconds: byDate.get(date.getTime()) ?? 0 };
  });
  const maxSeconds = Math.max(1, ...days.map((d) => d.seconds));
  const change = percentChange(thisWeekSeconds, lastWeekSeconds);

  return (
    <Card>
      <CardTitle>This Week</CardTitle>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="font-metric text-2xl font-semibold text-[var(--color-text)]">
          {formatDuration(thisWeekSeconds)}
        </span>
        <span className="text-sm text-[var(--color-text-muted)]">
          {change === null ? "New" : formatSignedPercent(change)} vs last week ({formatDuration(lastWeekSeconds)})
        </span>
      </div>

      <div className="mt-4 flex items-end gap-2" role="img" aria-label="Focus time by day this week">
        {days.map((d) => (
          <div key={d.date.toISOString()} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-20 w-full items-end">
              <div
                className="w-full rounded-t-[3px] bg-[var(--color-primary)] transition-[height] duration-300 motion-reduce:transition-none"
                style={{ height: `${(d.seconds / maxSeconds) * 100}%`, minHeight: d.seconds > 0 ? 2 : 0 }}
                title={`${formatWeekday(d.date)}: ${formatDuration(d.seconds)}`}
              />
            </div>
            <span className="text-[10px] text-[var(--color-text-faint)]">{formatWeekday(d.date).slice(0, 1)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
