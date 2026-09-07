"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { addManualTimeAction, editManualTimeAction } from "@/server/actions/manual-entry";
import { CategorySelect } from "./CategorySelect";
import type { CategoryOption } from "./types";

export interface ManualTimeInitial {
  sessionId: string;
  date: string;
  durationMinutes: number;
  categoryId: string | null;
  notes: string | null;
}

export function ManualTimeModal({
  categories,
  today,
  initial,
  onClose,
  onSaved,
}: {
  categories: CategoryOption[];
  today: string;
  initial?: ManualTimeInitial;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? today);
  const [durationMinutes, setDurationMinutes] = useState(initial?.durationMinutes ?? 30);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const input = {
        date,
        durationMinutes,
        categoryId: categoryId || null,
        notes: notes.trim() || null,
      };
      const result = initial
        ? await editManualTimeAction(initial.sessionId, input)
        : await addManualTimeAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved?.();
      onClose();
    });
  };

  return (
    <Modal title={initial ? "Edit Study Time" : "Add Study Time"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-date" className="text-sm font-medium text-[var(--color-text)]">
            Date
          </label>
          <input
            id="manual-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-duration" className="text-sm font-medium text-[var(--color-text)]">
            Duration (minutes)
          </label>
          <input
            id="manual-duration"
            type="number"
            min={1}
            step={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)]"
          />
        </div>

        <CategorySelect
          id="manual-category"
          name="categoryId"
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-notes" className="text-sm font-medium text-[var(--color-text)]">
            Description
          </label>
          <input
            id="manual-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Chapter 7 exercises"
            className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)]"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-sm)] px-4 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
