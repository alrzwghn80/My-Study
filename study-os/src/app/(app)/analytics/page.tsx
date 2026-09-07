import { requireUserId } from "@/server/actions/helpers";
import { getAnalyticsData } from "@/server/queries/analytics";
import { Card, CardTitle } from "@/components/ui/Card";
import { CategoryDistributionChart } from "@/components/analytics/CategoryDistributionChart";
import { MonthlyBarChart } from "@/components/analytics/MonthlyBarChart";
import { formatDuration, formatLocalDate, formatSignedPercent, formatWeekday } from "@/lib/format";
import { addDays } from "@/server/domain/calendar";

export default async function AnalyticsPage() {
  const userId = await requireUserId();
  const data = await getAnalyticsData(userId);
  const { weekly, monthly, yearly } = data;

  const weekByDate = new Map(weekly.dailyTotals.map((t) => [t.date.getTime(), t.focusSeconds]));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekly.weekStart, i);
    return { date, seconds: weekByDate.get(date.getTime()) ?? 0 };
  });
  const maxWeekSeconds = Math.max(1, ...weekDays.map((d) => d.seconds));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-[var(--color-text)]">Analytics</h1>

      <Card>
        <CardTitle>Weekly Trend</CardTitle>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="font-metric text-2xl font-semibold text-[var(--color-text)]">{formatDuration(weekly.thisWeekSeconds)}</span>
          <span className="text-sm text-[var(--color-text-muted)]">
            {weekly.changeFraction === null ? "New" : formatSignedPercent(weekly.changeFraction)} vs last week (
            {formatDuration(weekly.lastWeekSeconds)})
          </span>
        </div>
        <div className="mt-4 flex items-end gap-2" role="img" aria-label="Focus time by day this week">
          {weekDays.map((d) => (
            <div key={d.date.toISOString()} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end">
                <div
                  className="w-full rounded-t-[3px] bg-[var(--color-primary)]"
                  style={{ height: `${(d.seconds / maxWeekSeconds) * 100}%`, minHeight: d.seconds > 0 ? 2 : 0 }}
                  title={`${formatWeekday(d.date)}: ${formatDuration(d.seconds)}`}
                />
              </div>
              <span className="text-[10px] text-[var(--color-text-faint)]">{formatWeekday(d.date).slice(0, 1)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>{formatLocalDate(monthly.monthStart).replace(/ \d+, /, " ")}</CardTitle>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Total Study" value={formatDuration(monthly.totalSeconds)} />
          <Stat label="Study Days" value={String(monthly.studyDays)} />
          <Stat label="Sessions" value={String(monthly.sessionCount)} />
          <Stat label="Average / Calendar Day" value={formatDuration(monthly.averagePerCalendarDay)} />
          <Stat label="Average / Study Day" value={formatDuration(monthly.averagePerStudyDay)} />
          <Stat label="Longest Session" value={formatDuration(monthly.longestSessionSeconds)} />
        </div>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          {monthly.changeFraction === null ? "New this month" : `${formatSignedPercent(monthly.changeFraction)} vs last month`} (
          {formatDuration(monthly.previousMonthSeconds)})
        </p>
      </Card>

      <Card>
        <CardTitle>{yearly.yearStart.getUTCFullYear()}</CardTitle>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Total Study" value={formatDuration(yearly.totalSeconds)} />
          <Stat label="Study Days" value={String(yearly.studyDays)} />
          <Stat label="Sessions" value={String(yearly.totalSessions)} />
          <Stat label="Longest Streak" value={`${yearly.longestStreak} days`} />
          <Stat label="Best Month" value={yearly.bestMonth ? formatDuration(yearly.bestMonth.seconds) : "—"} />
          <Stat label="Worst Month" value={yearly.worstMonth ? formatDuration(yearly.worstMonth.seconds) : "—"} />
        </div>
        <div className="mt-5">
          <MonthlyBarChart data={yearly.monthlyTotals} />
        </div>
      </Card>

      <Card>
        <CardTitle>Skill Distribution ({yearly.yearStart.getUTCFullYear()})</CardTitle>
        {data.neglected && (
          <p className="mt-2 rounded-[var(--radius-sm)] bg-[var(--color-warning-soft)] px-3 py-2 text-sm text-[var(--color-warning)]">
            {data.neglected.categoryName} has received significantly less study time than usual this month.
          </p>
        )}
        <div className="mt-4">
          <CategoryDistributionChart data={data.categoryDistributionYear} />
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="font-metric text-base font-medium text-[var(--color-text)]">{value}</p>
    </div>
  );
}
