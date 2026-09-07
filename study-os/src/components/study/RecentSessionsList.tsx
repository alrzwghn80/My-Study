import { formatDuration, formatLocalDate } from "@/lib/format";

export interface SimpleSession {
  id: string;
  date: Date;
  focusSeconds: number;
}

export function RecentSessionsList({ sessions, emptyText }: { sessions: SimpleSession[]; emptyText: string }) {
  if (sessions.length === 0) {
    return <p className="text-sm text-[var(--color-text-faint)]">{emptyText}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-[var(--color-border)]">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center justify-between py-3 text-sm">
          <span className="text-[var(--color-text-muted)]">{formatLocalDate(s.date)}</span>
          <span className="font-metric text-[var(--color-text)]">{formatDuration(s.focusSeconds)}</span>
        </li>
      ))}
    </ul>
  );
}
