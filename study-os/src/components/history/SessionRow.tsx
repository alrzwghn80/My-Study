"use client";

import { useState } from "react";
import { formatDuration, formatLocalDate } from "@/lib/format";
import { deleteManualTimeAction } from "@/server/actions/manual-entry";
import { ManualTimeModal } from "@/components/timer/ManualTimeModal";
import type { CategoryOption } from "@/components/timer/types";

export interface SessionRowData {
  id: string;
  date: Date;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  source: "TRACKED" | "MANUAL";
  status: "COMPLETED" | "CANCELLED";
  focusSeconds: number;
  breakSeconds: number;
  productivityRating: number | null;
  difficultyRating: number | null;
  notes: string | null;
}

export function SessionRow({
  session,
  categories,
  today,
}: {
  session: SessionRowData;
  categories: CategoryOption[];
  today: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this manual entry? This cannot be undone.")) return;
    setDeleting(true);
    await deleteManualTimeAction(session.id);
    setDeleting(false);
  };

  return (
    <li className="border-b border-[var(--color-border)] py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: session.categoryColor ?? "#9a9a92" }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--color-text)]">
              {session.categoryName ?? "Uncategorized"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {formatLocalDate(session.date)} · {session.source === "MANUAL" ? "Manual" : "Tracked"}
              {session.status === "CANCELLED" ? " · Cancelled" : ""}
            </p>
          </div>
        </div>
        <span className="font-metric shrink-0 text-sm text-[var(--color-text)]">{formatDuration(session.focusSeconds)}</span>
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 rounded-[var(--radius-sm)] bg-[var(--color-bg)] p-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-[var(--color-text-muted)]">
            <span>Focus: {formatDuration(session.focusSeconds)}</span>
            <span>Break: {formatDuration(session.breakSeconds)}</span>
            {session.productivityRating != null && <span>Productivity: {session.productivityRating}/5</span>}
            {session.difficultyRating != null && <span>Difficulty: {session.difficultyRating}/5</span>}
          </div>
          {session.notes && <p className="text-[var(--color-text)]">{session.notes}</p>}

          {session.source === "MANUAL" && (
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-3 py-1 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="rounded-[var(--radius-sm)] px-3 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <ManualTimeModal
          categories={categories}
          today={today}
          initial={{
            sessionId: session.id,
            date: session.date.toISOString().slice(0, 10),
            durationMinutes: Math.round(session.focusSeconds / 60),
            categoryId: session.categoryId,
            notes: session.notes,
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  );
}
