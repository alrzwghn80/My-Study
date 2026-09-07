import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatDuration, formatLocalDate, toDateInputValue } from "@/lib/format";
import { addDays, startOfWeek } from "@/server/domain/calendar";
import type { DailyTotal } from "@/server/domain/analytics";

const THRESHOLDS_MIN = [0, 1, 30, 60, 120, 180]; // spec §17 intensity levels

function levelFor(seconds: number): number {
  const minutes = seconds / 60;
  let level = 0;
  for (let i = 0; i < THRESHOLDS_MIN.length; i++) {
    if (minutes >= THRESHOLDS_MIN[i]) level = i;
  }
  return level;
}

export function StudyCalendarHeatmap({
  start,
  end,
  totals,
}: {
  start: Date;
  end: Date;
  totals: DailyTotal[];
}) {
  const byDate = new Map(totals.map((t) => [t.date.getTime(), t.focusSeconds]));
  const gridStart = startOfWeek(start);

  const weeks: { date: Date; seconds: number }[][] = [];
  let cursor = gridStart;
  let week: { date: Date; seconds: number }[] = [];
  while (cursor.getTime() <= end.getTime()) {
    week.push({ date: cursor, seconds: byDate.get(cursor.getTime()) ?? 0 });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
    cursor = addDays(cursor, 1);
  }
  if (week.length > 0) {
    while (week.length < 7) {
      week.push({ date: cursor, seconds: 0 });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  return (
    <Card>
      <CardTitle>Activity</CardTitle>
      <div className="mt-4 overflow-x-auto">
        <div className="inline-flex gap-[3px]">
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {w.map((day) => {
                const inRange = day.date.getTime() >= start.getTime() && day.date.getTime() <= end.getTime();
                if (!inRange) return <div key={day.date.toISOString()} className="h-[11px] w-[11px]" />;
                const level = levelFor(day.seconds);
                return (
                  <Link
                    key={day.date.toISOString()}
                    href={`/history?date=${toDateInputValue(day.date)}`}
                    title={`${formatLocalDate(day.date)} — ${formatDuration(day.seconds)}`}
                    className="block h-[11px] w-[11px] rounded-[2px] outline-offset-2"
                    style={{ background: `var(--color-heat-${level})` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-text-faint)]">
        <span>Less</span>
        {THRESHOLDS_MIN.map((_, i) => (
          <span key={i} className="h-[10px] w-[10px] rounded-[2px]" style={{ background: `var(--color-heat-${i})` }} />
        ))}
        <span>More</span>
      </div>
    </Card>
  );
}
