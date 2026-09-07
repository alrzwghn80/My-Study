"use client";

import { useState } from "react";
import { formatDuration, formatLocalDate } from "@/lib/format";
import { deleteManualTimeAction } from "@/server/actions/manual-entry";
import { ManualTimeModal } from "@/components/timer/ManualTimeModal";

export interface SessionRowData {
  id: string;
  date: Date;
  focusSeconds: number;
  source: "TRACKED" | "MANUAL";
}

export function SessionRow({ session, today }: { session: SessionRowData; today: string }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  const handleDelete = async () => {
    if (!confirm("Delete this entry?")) return;
    setDeleting(true);
    const result = await deleteManualTimeAction(session.id);
    if (result.ok) setHidden(true);
    setDeleting(false);
  };

  return (
    <li className="group flex items-center justify-between py-3 text-sm">
      <span className="text-[var(--color-text-muted)]">{formatLocalDate(session.date)}</span>
      <div className="flex items-center gap-3">
        <span className="font-metric text-[var(--color-text)]">{formatDuration(session.focusSeconds)}</span>
        {session.source === "MANUAL" && (
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-text)]"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-danger)] disabled:opacity-60"
            >
              Delete
            </button>
          </span>
        )}
      </div>

      {editing && (
        <ManualTimeModal
          today={today}
          initial={{ sessionId: session.id, date: session.date.toISOString().slice(0, 10), durationMinutes: Math.round(session.focusSeconds / 60) }}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  );
}
