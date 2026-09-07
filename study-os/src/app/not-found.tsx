import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--color-bg)] px-4 text-center">
      <h1 className="text-lg font-semibold text-[var(--color-text)]">Page not found</h1>
      <p className="text-sm text-[var(--color-text-muted)]">That page doesn&apos;t exist.</p>
      <Link href="/" className="mt-2 text-sm font-medium text-[var(--color-primary)] underline underline-offset-2">
        Back to dashboard
      </Link>
    </main>
  );
}
