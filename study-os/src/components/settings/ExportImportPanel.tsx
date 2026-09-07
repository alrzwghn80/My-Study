"use client";

import { useRef, useState, useTransition } from "react";
import { exportCsvAction, exportJsonAction, importJsonAction } from "@/server/actions/export-import";

function download(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportImportPanel() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    setError(null);
    startTransition(async () => {
      const result = await exportJsonAction();
      if (!result.ok) return setError(result.error);
      download(`german-study-os-backup-${new Date().toISOString().slice(0, 10)}.json`, result.data, "application/json");
    });
  };

  const exportCsv = () => {
    setError(null);
    startTransition(async () => {
      const result = await exportCsvAction();
      if (!result.ok) return setError(result.error);
      download(`german-study-os-sessions-${new Date().toISOString().slice(0, 10)}.csv`, result.data, "text/csv");
    });
  };

  const importFile = (file: File) => {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const text = await file.text();
      const result = await importJsonAction(text);
      if (!result.ok) return setError(result.error);
      setMessage(
        `Imported ${result.data.sessionsImported} sessions, ${result.data.categoriesCreated} new categories (${result.data.categoriesMatched} matched existing), ${result.data.goalsUpserted} goals, ${result.data.longTermGoalsImported} long-term goals.`,
      );
    });
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Backup</h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={exportJson}
          disabled={pending}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-60"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={pending}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-60"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] disabled:opacity-60"
        >
          Import JSON backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-faint)]">
        Import is additive — it never deletes or overwrites existing data. Re-importing the same backup twice is safe.
      </p>
      {message && <p className="mt-2 text-sm text-[var(--color-success)]">{message}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
