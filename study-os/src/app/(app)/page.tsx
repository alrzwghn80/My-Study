import { requireUserId } from "@/server/actions/helpers";
import { getStudyPageData } from "@/server/queries/study";
import { StudyTimer } from "@/components/timer/StudyTimer";
import { RecentDaysChart } from "@/components/study/RecentDaysChart";
import { RecentSessionsList } from "@/components/study/RecentSessionsList";

export default async function StudyPage() {
  const userId = await requireUserId();
  const data = await getStudyPageData(userId);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-14 px-2 pb-10">
      <StudyTimer
        initialSession={data.activeSession}
        timezone={data.timezone}
        todayFocusSeconds={data.todayFocusSeconds}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm text-[var(--color-text-muted)]">Recent days</h2>
        <RecentDaysChart start={data.chartStart} end={data.today} totals={data.chartTotals} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-[var(--color-text-muted)]">Recent activity</h2>
        <RecentSessionsList sessions={data.recentSessions} emptyText="No sessions yet — start studying to see them here." />
      </section>
    </div>
  );
}
