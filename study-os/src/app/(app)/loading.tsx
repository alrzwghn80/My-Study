export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="h-56 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-border)] motion-reduce:animate-none" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-border)] motion-reduce:animate-none" />
        <div className="h-32 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-border)] motion-reduce:animate-none" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
