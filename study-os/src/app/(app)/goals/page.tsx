import { requireUserId } from "@/server/actions/helpers";
import { getGoalsPageData } from "@/server/queries/goals";
import { GoalPeriod } from "@/generated/prisma/enums";
import { GoalPeriodEditor } from "@/components/goals/GoalPeriodEditor";
import { LongTermGoalCard } from "@/components/goals/LongTermGoalCard";
import { LongTermGoalForm } from "@/components/goals/LongTermGoalForm";
import { toDateInputValue } from "@/lib/format";

export default async function GoalsPage() {
  const userId = await requireUserId();
  const data = await getGoalsPageData(userId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-[var(--color-text)]">Goals</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GoalPeriodEditor period={GoalPeriod.DAILY} title="Daily" initial={data.daily} />
        <GoalPeriodEditor period={GoalPeriod.WEEKLY} title="Weekly" initial={data.weekly} />
        <GoalPeriodEditor period={GoalPeriod.MONTHLY} title="Monthly" initial={data.monthly} />
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)]">Long-Term Goals</h2>
        {data.longTermGoals.map((goal) => (
          <LongTermGoalCard key={goal.id} goal={goal} />
        ))}
        <LongTermGoalForm today={toDateInputValue(data.today)} />
      </div>
    </div>
  );
}
