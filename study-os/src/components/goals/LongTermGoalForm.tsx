"use client";

import { useState, useTransition } from "react";
import { createLongTermGoalAction } from "@/server/actions/goals";

export function LongTermGoalForm({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [targetHours, setTargetHours] = useState(500);
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)]"
      >
        + New Long-Term Goal
      </button>
    );
  }

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await createLongTermGoalAction({
        title,
        targetHours,
        targetDate: targetDate || null,
        startDate: today,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setTitle("");
    });
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">New Long-Term Goal</h3>
      <div className="mt-3 flex flex-col gap-3">
        <input
          type="text"
          placeholder="e.g. German B2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)]">Target hours</label>
            <input
              type="number"
              min={1}
              value={targetHours}
              onChange={(e) => setTargetHours(Number(e.target.value))}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)]">Target date (optional)</label>
            <input
              type="date"
              min={today}
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]"
            />
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-[var(--radius-sm)] px-4 py-1.5 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || !title.trim()}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
