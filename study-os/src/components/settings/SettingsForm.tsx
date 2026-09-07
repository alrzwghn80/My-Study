"use client";

import { useEffect, useState, useTransition } from "react";
import { updateSettingsAction } from "@/server/actions/settings";
import { COMMON_TIMEZONES } from "@/lib/timezones";

export interface SettingsInitial {
  timezone: string;
  streakThresholdMinutes: number;
  theme: "light" | "dark" | "system";
  reducedMotion: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  autoStartBreakOnPause: boolean;
}

export function SettingsForm({ initial }: { initial: SettingsInitial }) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Read only after mount to avoid a server/client render mismatch —
  // `Notification` doesn't exist during server rendering.
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);
  useEffect(() => {
    // Reading a browser-only global on mount, specifically to avoid a
    // server/client render mismatch (Notification doesn't exist on the
    // server) — the one legitimate case for this pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof Notification !== "undefined") setNotificationPermission(Notification.permission);
  }, []);

  const set = <K extends keyof SettingsInitial>(key: K, value: SettingsInitial[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateSettingsAction(values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="General">
        <Field label="Timezone">
          <select
            value={values.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="Motivation">
        <Field label="Minimum focus time to count as a study day (minutes)">
          <input
            type="number"
            min={1}
            value={values.streakThresholdMinutes}
            onChange={(e) => set("streakThresholdMinutes", Number(e.target.value))}
            className="w-32 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          />
        </Field>
      </Section>

      <Section title="Timer">
        <Toggle
          label="Automatically start a break when paused"
          checked={values.autoStartBreakOnPause}
          onChange={(v) => set("autoStartBreakOnPause", v)}
        />
        <Toggle label="Sound on state changes" checked={values.soundEnabled} onChange={(v) => set("soundEnabled", v)} />
        <Toggle
          label="Browser notifications (e.g. goal reminders)"
          checked={values.notificationsEnabled}
          onChange={(v) => {
            set("notificationsEnabled", v);
            if (v && typeof Notification !== "undefined" && Notification.permission === "default") {
              void Notification.requestPermission().then(setNotificationPermission);
            }
          }}
        />
        {values.notificationsEnabled && notificationPermission === "denied" && (
          <p className="text-xs text-[var(--color-warning)]">
            Notifications are blocked in your browser settings — enable them for this site to receive reminders.
          </p>
        )}
      </Section>

      <Section title="Appearance">
        <Field label="Theme">
          <select
            value={values.theme}
            onChange={(e) => set("theme", e.target.value as SettingsInitial["theme"])}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </Field>
        <Toggle label="Reduce motion" checked={values.reducedMotion} onChange={(v) => set("reducedMotion", v)} />
      </Section>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-[var(--color-primary-fg)] hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Settings"}
        </button>
        {saved && <span className="text-sm text-[var(--color-success)]">Saved ✓</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-[var(--color-text)]">
      {label}
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-[var(--color-text)]">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--color-primary)]"
      />
    </label>
  );
}
