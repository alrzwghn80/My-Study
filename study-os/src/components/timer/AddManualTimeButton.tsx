"use client";

import { useState } from "react";
import { ManualTimeModal } from "./ManualTimeModal";
import type { CategoryOption } from "./types";

export function AddManualTimeButton({ categories, today }: { categories: CategoryOption[]; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)]"
      >
        + Add Study Time
      </button>
      {open && <ManualTimeModal categories={categories} today={today} onClose={() => setOpen(false)} />}
    </>
  );
}
