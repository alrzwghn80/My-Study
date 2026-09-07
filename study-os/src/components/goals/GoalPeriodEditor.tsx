"use client";

import { useState, useTransition } from "react";
import { setGoalsAction } from "@/server/actions/goals";
import type { GoalPeriod } from "@/generated/prisma/enums";
import type { GoalSet } from "@/server/domain/goals";

function secondsToHours(seconds: number | null): string {
  return seconds === null ? "" : String(Math.round((seconds / 3600) * 100) / 100);
}

export function GoalPeriodEditor({ period, title, initial }: { period: GoalPeriod; title: string; initial: GoalSet }) {
  const [minimum, setMinimum] = useState(secondsToHours(initial.minimum));
  const [target, setTarget] = useState(secondsToHours(initial.target));
  const [stretch, setStretch] = useState(secondsToHours(initial.stretch));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setGoalsAction({
        period,
        minimumMinutes: minimum ? Number(minimum) * 60 : null,
        targetMinutes: target ? Number(target) * 60 : null,
        stretchMinutes: stretch ? Number(stretch) * 60 : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Field label="Minimum (hrs)" value={minimum} onChange={setMinimum} />
        <Field label="Target (hrs)" value={target} onChange={setTarget} />
        <Field label="Stretch (hrs)" value={stretch} onChange={setStretch} />
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-[var(--color-success)]">Saved ✓</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--color-text-muted)]">{label}</label>
      <input
        type="number"
        min={0}
        step={0.25}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)]"
      />
    </div>
  );
}
