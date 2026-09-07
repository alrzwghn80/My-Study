import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/Card";
import { formatDuration } from "@/lib/format";
import type { CategoryTotal } from "@/server/domain/analytics";

export function AnalyticsSummaryCard({
  monthSeconds,
  topCategory,
}: {
  monthSeconds: number;
  topCategory: CategoryTotal | null;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Analytics</CardTitle>
        <Link href="/analytics" className="text-xs font-medium text-[var(--color-primary)] underline underline-offset-2">
          View all
        </Link>
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <div>
          <p className="text-[var(--color-text-muted)]">This month</p>
          <p className="font-metric text-lg text-[var(--color-text)]">{formatDuration(monthSeconds)}</p>
        </div>
        {topCategory && (
          <div className="text-right">
            <p className="text-[var(--color-text-muted)]">Most studied</p>
            <p className="text-sm font-medium text-[var(--color-text)]">{topCategory.categoryName}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
