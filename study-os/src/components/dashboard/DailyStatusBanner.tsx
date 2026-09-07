import { formatDuration } from "@/lib/format";

export function DailyStatusBanner({
  focusSeconds,
  targetSeconds,
}: {
  focusSeconds: number;
  targetSeconds: number | null;
}) {
  if (!targetSeconds) return null;

  const remaining = targetSeconds - focusSeconds;
  const tone = remaining <= 0 ? "success" : remaining <= targetSeconds * 0.25 ? "warning" : "neutral";

  const bg = tone === "success" ? "bg-[var(--color-success-soft)]" : tone === "warning" ? "bg-[var(--color-warning-soft)]" : "bg-[var(--color-primary-soft)]";
  const fg = tone === "success" ? "text-[var(--color-success)]" : tone === "warning" ? "text-[var(--color-warning)]" : "text-[var(--color-primary)]";

  let heading: string;
  let detail: string;
  if (remaining <= 0) {
    heading = "Goal Completed";
    detail =
      focusSeconds > targetSeconds
        ? `You studied ${formatDuration(focusSeconds)} today — exceeded your target by ${formatDuration(focusSeconds - targetSeconds)}.`
        : `You studied ${formatDuration(focusSeconds)} today, right at your target.`;
  } else if (focusSeconds === 0) {
    heading = "Not started yet";
    detail = `Today's target is ${formatDuration(targetSeconds)}.`;
  } else {
    heading = "On Track";
    detail = `You've studied ${formatDuration(focusSeconds)}. You need ${formatDuration(remaining)} to reach today's target.`;
  }

  return (
    <div className={`rounded-[var(--radius-md)] ${bg} px-4 py-3`}>
      <p className={`text-sm font-semibold ${fg}`}>{heading}{remaining <= 0 ? " ✓" : ""}</p>
      <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{detail}</p>
    </div>
  );
}
