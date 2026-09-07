import { requireUserId } from "@/server/actions/helpers";
import { prisma } from "@/server/db/client";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { ExportImportPanel } from "@/components/settings/ExportImportPanel";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [settings, categories] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { userId } }),
    prisma.category.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-[var(--color-text)]">Settings</h1>

      <SettingsForm
        initial={{
          timezone: settings.timezone,
          streakThresholdMinutes: Math.round(settings.streakThresholdSeconds / 60),
          theme: settings.theme as "light" | "dark" | "system",
          reducedMotion: settings.reducedMotion,
          notificationsEnabled: settings.notificationsEnabled,
          soundEnabled: settings.soundEnabled,
          autoStartBreakOnPause: settings.autoStartBreakOnPause,
        }}
      />

      <CategoryManager categories={categories} />

      <ExportImportPanel />
    </div>
  );
}
