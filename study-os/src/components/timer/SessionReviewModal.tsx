"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { saveReviewAction } from "@/server/actions/timer";
import { formatDurationLong } from "@/lib/format";
import { CategorySelect } from "./CategorySelect";
import type { CategoryOption } from "./types";

function RatingPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
      <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            onClick={() => onChange(n)}
            className={`h-9 w-9 rounded-[var(--radius-sm)] border text-sm font-medium transition-colors ${
              value === n
                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                : "border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SessionReviewModal({
  sessionId,
  focusSeconds,
  categories,
  onClose,
}: {
  sessionId: string;
  focusSeconds: number;
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const [productivity, setProductivity] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    startTransition(async () => {
      const result = await saveReviewAction({
        sessionId,
        categoryId: categoryId || null,
        productivityRating: productivity,
        difficultyRating: difficulty,
        notes: notes.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Modal title="Session complete" onClose={onClose}>
      <p className="mb-4 font-metric text-2xl text-[var(--color-text)]">{formatDurationLong(focusSeconds)}</p>

      <div className="flex flex-col gap-4">
        <CategorySelect
          id="review-category"
          name="categoryId"
          categories={categories}
          value={categoryId}
          onChange={setCategoryId}
          label="What did you study?"
        />
        <RatingPicker label="Productivity" value={productivity} onChange={setProductivity} />
        <RatingPicker label="Difficulty" value={difficulty} onChange={setDifficulty} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="review-notes" className="text-sm font-medium text-[var(--color-text)]">
            Notes
          </label>
          <textarea
            id="review-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)]"
            placeholder="Chapter 7 exercises…"
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
            Skip
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save Session"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
