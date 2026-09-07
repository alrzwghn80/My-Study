"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto mt-16 max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
      <h1 className="text-base font-semibold text-[var(--color-text)]">Something went wrong</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        We couldn&apos;t load this page. Nothing was lost — your study data is safe in the database. Please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)]"
      >
        Try again
      </button>
    </div>
  );
}
