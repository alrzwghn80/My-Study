import { Card, CardTitle } from "@/components/ui/Card";
import { formatDuration } from "@/lib/format";

export function RecordChasingCard({
  yesterdaySeconds,
  todaySeconds,
  remainingToBeat,
  beaten,
}: {
  yesterdaySeconds: number;
  todaySeconds: number;
  remainingToBeat: number;
  beaten: boolean;
}) {
  if (yesterdaySeconds === 0) return null; // nothing meaningful to chase — spec §23: use sparingly

  return (
    <Card>
      <CardTitle>Yesterday vs Today</CardTitle>
      <div className="mt-3 flex justify-between text-sm">
        <div>
          <p className="text-[var(--color-text-muted)]">Yesterday</p>
          <p className="font-metric text-lg text-[var(--color-text)]">{formatDuration(yesterdaySeconds)}</p>
        </div>
        <div className="text-right">
          <p className="text-[var(--color-text-muted)]">Today</p>
          <p className="font-metric text-lg text-[var(--color-text)]">{formatDuration(todaySeconds)}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-muted)]">
        {beaten ? "You've beaten yesterday. ✓" : `${formatDuration(remainingToBeat)} needed to beat yesterday.`}
      </p>
    </Card>
  );
}
