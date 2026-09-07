"use client";

import { useTransition } from "react";
import { exportJsonAction } from "@/server/actions/export-import";

export function ExportLink() {
  const [pending, startTransition] = useTransition();

  const exportData = () => {
    startTransition(async () => {
      const result = await exportJsonAction();
      if (!result.ok) return;
      const blob = new Blob([result.data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `german-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <button
      type="button"
      onClick={exportData}
      disabled={pending}
      className="text-left text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-60"
    >
      {pending ? "Exporting…" : "Export my data"}
    </button>
  );
}
