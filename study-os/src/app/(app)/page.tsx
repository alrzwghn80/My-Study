import { requireUserId } from "@/server/actions/helpers";
import { getDashboardData } from "@/server/queries/dashboard";
import { StudyTimer } from "@/components/timer/StudyTimer";
import { AddManualTimeButton } from "@/components/timer/AddManualTimeButton";
import { TodaysGoalCard } from "@/components/dashboard/TodaysGoalCard";
import { StreakCard } from "@/components/dashboard/StreakCard";
import { DailyStatusBanner } from "@/components/dashboard/DailyStatusBanner";
import { WeeklyProgressCard } from "@/components/dashboard/WeeklyProgressCard";
import { RecordChasingCard } from "@/components/dashboard/RecordChasingCard";
import { StudyCalendarHeatmap } from "@/components/dashboard/StudyCalendarHeatmap";
import { AnalyticsSummaryCard } from "@/components/dashboard/AnalyticsSummaryCard";
import { GoalReminderNotifier } from "@/components/dashboard/GoalReminderNotifier";
import { toDateInputValue } from "@/lib/format";
import { prisma } from "@/server/db/client";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const [data, settings] = await Promise.all([
    getDashboardData(userId),
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <GoalReminderNotifier
        enabled={settings.notificationsEnabled}
        focusSeconds={data.todayFocusSeconds}
        targetSeconds={data.dailyGoals.target ?? data.dailyGoals.minimum}
        dateKey={toDateInputValue(data.today)}
      />
      <StudyTimer initialSession={data.activeSession} categories={data.categories} timezone={data.timezone} />

      <DailyStatusBanner focusSeconds={data.todayFocusSeconds} targetSeconds={data.dailyGoals.target ?? data.dailyGoals.minimum} />

      <div className="flex justify-end">
        <AddManualTimeButton categories={data.categories} today={toDateInputValue(data.today)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TodaysGoalCard focusSeconds={data.todayFocusSeconds} goals={data.dailyGoals} completion={data.dailyCompletion} />
        <StreakCard current={data.streak.current} longest={data.streak.longest} consistency30d={data.consistency30d} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WeeklyProgressCard
          weekStart={data.weekStart}
          thisWeekSeconds={data.thisWeekSeconds}
          lastWeekSeconds={data.lastWeekSeconds}
          totals={data.thisWeekTotals}
        />
        <RecordChasingCard
          yesterdaySeconds={data.yesterdayChase.yesterdaySeconds}
          todaySeconds={data.yesterdayChase.todaySeconds}
          remainingToBeat={data.yesterdayChase.remainingToBeat}
          beaten={data.yesterdayChase.beaten}
        />
      </div>

      <StudyCalendarHeatmap start={data.heatmapStart} end={data.today} totals={data.heatmap} />

      <AnalyticsSummaryCard monthSeconds={data.monthSeconds} topCategory={data.topCategoryThisMonth} />
    </div>
  );
}
