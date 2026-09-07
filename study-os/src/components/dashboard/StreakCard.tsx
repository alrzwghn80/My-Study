import { Card, CardTitle } from "@/components/ui/Card";
import { formatPercent } from "@/lib/format";

export function StreakCard({
  current,
  longest,
  consistency30d,
}: {
  current: number;
  longest: number;
  consistency30d: number;
}) {
  return (
    <Card>
      <CardTitle>Streak</CardTitle>
      <div className="mt-3 flex items-end gap-2">
        <span className="font-metric text-3xl font-semibold text-[var(--color-text)]">{current}</span>
        <span className="pb-1 text-sm text-[var(--color-text-muted)]">{current === 1 ? "day" : "days"}</span>
      </div>
      <div className="mt-3 flex justify-between text-sm text-[var(--color-text-muted)]">
        <span>Longest: {longest}</span>
        <span>Consistency (30d): {formatPercent(consistency30d)}</span>
      </div>
    </Card>
  );
}
