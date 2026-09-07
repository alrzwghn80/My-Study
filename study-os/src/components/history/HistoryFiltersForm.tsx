import { CategorySelect } from "@/components/timer/CategorySelect";
import type { CategoryOption } from "@/components/timer/types";

export function HistoryFiltersForm({
  categories,
  current,
}: {
  categories: CategoryOption[];
  current: {
    dateFrom?: string;
    dateTo?: string;
    categoryId?: string;
    source?: string;
    status?: string;
    minDuration?: string;
    search?: string;
  };
}) {
  return (
    <form className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6" method="get">
      <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
        <label htmlFor="dateFrom" className="text-xs font-medium text-[var(--color-text-muted)]">
          From
        </label>
        <input
          id="dateFrom"
          name="dateFrom"
          type="date"
          defaultValue={current.dateFrom}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text)]"
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
        <label htmlFor="dateTo" className="text-xs font-medium text-[var(--color-text-muted)]">
          To
        </label>
        <input
          id="dateTo"
          name="dateTo"
          type="date"
          defaultValue={current.dateTo}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text)]"
        />
      </div>

      <div className="col-span-2">
        <CategorySelect id="categoryId" name="categoryId" categories={categories} defaultValue={current.categoryId} label="Category" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="source" className="text-xs font-medium text-[var(--color-text-muted)]">
          Source
        </label>
        <select
          id="source"
          name="source"
          defaultValue={current.source ?? ""}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text)]"
        >
          <option value="">All</option>
          <option value="TRACKED">Tracked</option>
          <option value="MANUAL">Manual</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-xs font-medium text-[var(--color-text-muted)]">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={current.status ?? ""}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text)]"
        >
          <option value="">Completed + Cancelled</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="minDuration" className="text-xs font-medium text-[var(--color-text-muted)]">
          Min. minutes
        </label>
        <input
          id="minDuration"
          name="minDuration"
          type="number"
          min={0}
          defaultValue={current.minDuration}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text)]"
        />
      </div>

      <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-3 md:col-span-3">
        <label htmlFor="search" className="text-xs font-medium text-[var(--color-text-muted)]">
          Search notes
        </label>
        <input
          id="search"
          name="search"
          type="search"
          defaultValue={current.search}
          placeholder="Kapitel 7…"
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 py-1.5 text-sm text-[var(--color-text)]"
        />
      </div>

      <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
        <button
          type="submit"
          className="w-full rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)]"
        >
          Filter
        </button>
      </div>
    </form>
  );
}
