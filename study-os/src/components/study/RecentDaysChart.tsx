import { formatDuration, formatWeekday } from "@/lib/format";
import type { DailyTotal } from "@/server/domain/analytics";
import { addDays } from "@/server/domain/calendar";

/**
 * The one chart in the app (per the redesign brief: "a simple chart showing
 * study time across days is enough" — not a dashboard of widgets). Used by
 * both the Study page (7 days) and History (more days), just with a
 * different range.
 */
export function RecentDaysChart({
  start,
  end,
  totals,
}: {
  start: Date;
  end: Date;
  totals: DailyTotal[];
}) {
  const byDate = new Map(totals.map((t) => [t.date.getTime(), t.focusSeconds]));
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const days = Array.from({ length: dayCount }, (_, i) => {
    const date = addDays(start, i);
    return { date, seconds: byDate.get(date.getTime()) ?? 0 };
  });
  const maxSeconds = Math.max(1, ...days.map((d) => d.seconds));
  const showLabels = dayCount <= 14;

  return (
    <div className="flex items-end gap-1.5 sm:gap-2" role="img" aria-label="Study time over recent days">
      {days.map((d) => (
        <div key={d.date.toISOString()} className="group flex flex-1 flex-col items-center gap-2">
          <div className="relative flex h-28 w-full items-end sm:h-36">
            <div
              className="w-full rounded-[3px] bg-[var(--color-primary)] opacity-90 transition-[height,opacity] duration-300 ease-out group-hover:opacity-100 motion-reduce:transition-none"
              style={{ height: `${(d.seconds / maxSeconds) * 100}%`, minHeight: d.seconds > 0 ? 3 : 0 }}
            />
            <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100">
              {formatDuration(d.seconds)}
            </span>
          </div>
          {showLabels && (
            <span className="text-xs text-[var(--color-text-faint)]">{formatWeekday(d.date).slice(0, 1)}</span>
          )}
        </div>
      ))}
    </div>
  );
}
