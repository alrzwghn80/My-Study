import type { CategoryOption } from "./types";

export function CategorySelect({
  id,
  name,
  categories,
  defaultValue,
  value,
  onChange,
  label = "Category",
  required = false,
}: {
  id: string;
  name: string;
  categories: CategoryOption[];
  defaultValue?: string | null;
  value?: string;
  onChange?: (value: string) => void;
  label?: string;
  required?: boolean;
}) {
  const controlledProps =
    value !== undefined ? { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value) } : { defaultValue: defaultValue ?? "" };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-[var(--color-text)]">
        {label}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)]"
        {...controlledProps}
      >
        <option value="">{required ? "Choose a category…" : "No category"}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
