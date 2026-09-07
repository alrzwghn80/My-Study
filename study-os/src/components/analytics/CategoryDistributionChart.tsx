import { formatDuration, formatPercent } from "@/lib/format";
import type { CategoryTotal } from "@/server/domain/analytics";

export function CategoryDistributionChart({ data }: { data: CategoryTotal[] }) {
  const total = data.reduce((s, c) => s + c.focusSeconds, 0);
  if (total === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">No study time recorded in this range yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {data.map((c) => {
        const fraction = c.focusSeconds / total;
        return (
          <li key={c.categoryId ?? "uncategorized"}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-[var(--color-text)]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden="true" />
                {c.categoryName}
              </span>
              <span className="text-[var(--color-text-muted)]">
                {formatDuration(c.focusSeconds)} · {formatPercent(fraction)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div className="h-full rounded-full" style={{ width: `${fraction * 100}%`, background: c.color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
