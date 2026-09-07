import { requireUserId } from "@/server/actions/helpers";
import { getHistoryPageData } from "@/server/queries/history";
import { prisma } from "@/server/db/client";
import { RecentDaysChart } from "@/components/study/RecentDaysChart";
import { SessionRow } from "@/components/history/SessionRow";
import { AddTimeLink } from "@/components/history/AddTimeLink";
import { PageLinks } from "@/components/history/PageLinks";
import { toDateInputValue } from "@/lib/format";
import { todayInTimezone } from "@/server/domain/calendar";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const userId = await requireUserId();
  const { page: pageParam } = await searchParams;
  const page = pageParam ? Math.max(1, Number(pageParam) || 1) : 1;

  const [data, settings] = await Promise.all([
    getHistoryPageData(userId, page),
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
  ]);
  const today = todayInTimezone(settings.timezone);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-12 px-2 pb-10">
      <section className="flex flex-col gap-4 pt-4">
        <h2 className="text-sm text-[var(--color-text-muted)]">Last 30 days</h2>
        <RecentDaysChart start={data.chartStart} end={data.chartEnd} totals={data.chartTotals} />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-[var(--color-text-muted)]">All sessions</h2>
          <AddTimeLink today={toDateInputValue(today)} />
        </div>

        {data.sessions.length === 0 && page === 1 ? (
          <p className="py-6 text-sm text-[var(--color-text-faint)]">No study history yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-border)]">
            {data.sessions.map((s) => (
              <SessionRow key={s.id} session={s} today={toDateInputValue(today)} />
            ))}
          </ul>
        )}

        <PageLinks page={data.page} hasNextPage={data.hasNextPage} />
      </section>
    </div>
  );
}
