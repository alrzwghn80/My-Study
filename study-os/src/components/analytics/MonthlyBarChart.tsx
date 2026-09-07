import { formatDuration } from "@/lib/format";

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export function MonthlyBarChart({ data }: { data: { month: Date; seconds: number }[] }) {
  const maxSeconds = Math.max(1, ...data.map((d) => d.seconds));

  return (
    <div className="flex items-end gap-2" role="img" aria-label="Monthly focus time this year">
      {data.map((d) => (
        <div key={d.month.toISOString()} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-28 w-full items-end">
            <div
              className="w-full rounded-t-[3px] bg-[var(--color-primary)]"
              style={{ height: `${(d.seconds / maxSeconds) * 100}%`, minHeight: d.seconds > 0 ? 2 : 0 }}
              title={`${formatDuration(d.seconds)}`}
            />
          </div>
          <span className="text-[10px] text-[var(--color-text-faint)]">{MONTH_LABELS[d.month.getUTCMonth()]}</span>
        </div>
      ))}
    </div>
  );
}
