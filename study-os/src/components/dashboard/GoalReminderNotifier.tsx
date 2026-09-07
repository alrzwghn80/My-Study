"use client";

import { useEffect } from "react";
import { formatDuration } from "@/lib/format";

/**
 * Fires at most one browser Notification per calendar day (deduped via
 * localStorage) when the daily target isn't met yet — spec §44. This is
 * intentionally simple: it only fires while the dashboard is open (no
 * service worker / push infrastructure), which is an honest scope for a
 * private single-user app and is documented as such in docs/architecture.md.
 */
export function GoalReminderNotifier({
  enabled,
  focusSeconds,
  targetSeconds,
  dateKey,
}: {
  enabled: boolean;
  focusSeconds: number;
  targetSeconds: number | null;
  dateKey: string;
}) {
  useEffect(() => {
    if (!enabled || !targetSeconds || focusSeconds >= targetSeconds) return;
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const storageKey = `study-os:goal-reminder-shown:${dateKey}`;
    try {
      if (localStorage.getItem(storageKey)) return;
      localStorage.setItem(storageKey, "1");
    } catch {
      return; // storage blocked — skip rather than risk repeat-notifying every render
    }

    const remaining = targetSeconds - focusSeconds;
    new Notification("Today's German study goal", {
      body: `You haven't reached today's goal yet. You need ${formatDuration(remaining)} more.`,
      tag: "study-os-daily-goal",
    });
  }, [enabled, focusSeconds, targetSeconds, dateKey]);

  return null;
}
