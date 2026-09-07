"use client";

import { useState, useTransition } from "react";
import { createCategoryAction, setCategoryArchivedAction } from "@/server/actions/categories";

export interface CategoryData {
  id: string;
  name: string;
  color: string;
  isArchived: boolean;
}

const PALETTE = ["#2f6f4f", "#3f7fb0", "#9a6fb0", "#b0813f", "#b0533f", "#3fb094", "#b03f8e", "#5b5fb0"];

export function CategoryManager({ categories }: { categories: CategoryData[] }) {
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const active = categories.filter((c) => !c.isArchived);
  const archived = categories.filter((c) => c.isArchived);

  const add = () => {
    setError(null);
    startTransition(async () => {
      const color = PALETTE[categories.length % PALETTE.length];
      const result = await createCategoryAction(newName, color);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewName("");
    });
  };

  const toggleArchive = (id: string, isArchived: boolean) => {
    startTransition(() => void setCategoryArchivedAction(id, isArchived));
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">Categories</h2>

      <ul className="flex flex-col gap-2">
        {active.map((c) => (
          <li key={c.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
              {c.name}
            </span>
            <button
              type="button"
              onClick={() => toggleArchive(c.id, true)}
              disabled={pending}
              className="text-xs text-[var(--color-text-faint)] hover:text-[var(--color-danger)] disabled:opacity-60"
            >
              Archive
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)]"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !newName.trim()}
          className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary-fg)] disabled:opacity-60"
        >
          Add
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {archived.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-[var(--color-text-muted)]">
            Archived ({archived.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm text-[var(--color-text-faint)]">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full opacity-50" style={{ background: c.color }} />
                  {c.name}
                </span>
                <button
                  type="button"
                  onClick={() => toggleArchive(c.id, false)}
                  disabled={pending}
                  className="text-xs text-[var(--color-primary)] hover:underline disabled:opacity-60"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
