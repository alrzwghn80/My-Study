"use client";

import { useState, useTransition } from "react";
import { updateSettingsAction } from "@/server/actions/settings";
import { COMMON_TIMEZONES } from "@/lib/timezones";

export interface SettingsInitial {
  timezone: string;
  theme: "light" | "dark" | "system";
}

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof SettingsInitial>(key: K, value: SettingsInitial[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const result = await updateSettingsAction(next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="timezone" className="text-sm text-[var(--color-text-muted)]">
          Timezone
        </label>
        <select
          id="timezone"
          value={values.timezone}
          onChange={(e) => set("timezone", e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <p className="text-xs text-[var(--color-text-faint)]">Used to work out where one study day ends and the next begins.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="theme" className="text-sm text-[var(--color-text-muted)]">
          Appearance
        </label>
        <select
          id="theme"
          value={values.theme}
          onChange={(e) => set("theme", e.target.value as SettingsInitial["theme"])}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
        >
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}
      {pending ? (
        <span className="text-xs text-[var(--color-text-faint)]">Saving…</span>
      ) : (
        saved && <span className="text-xs text-[var(--color-success)]">Saved</span>
      )}
    </div>
  );
}
