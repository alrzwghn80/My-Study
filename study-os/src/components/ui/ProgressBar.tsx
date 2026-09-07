/**
 * A goal-progress bar. Never communicates "completed" through color alone
 * (spec §47) — the checkmark/label carries that, color is secondary.
 */
export function ProgressBar({
  fraction,
  tone = "primary",
  className = "",
}: {
  fraction: number;
  tone?: "primary" | "success" | "warning";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  const color =
    tone === "success"
      ? "var(--color-success)"
      : tone === "warning"
        ? "var(--color-warning)"
        : "var(--color-primary)";

  return (
    <div
      className={`h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-border)] ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
