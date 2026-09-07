"use client";

import { useState } from "react";
import { ManualTimeModal } from "@/components/timer/ManualTimeModal";

export function AddTimeLink({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        + Add time
      </button>
      {open && <ManualTimeModal today={today} onClose={() => setOpen(false)} />}
    </>
  );
}
