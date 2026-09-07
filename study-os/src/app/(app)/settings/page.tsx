import { requireUserId } from "@/server/actions/helpers";
import { prisma } from "@/server/db/client";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { SignOutButton } from "@/components/settings/SignOutButton";
import { ExportLink } from "@/components/settings/ExportLink";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-10 py-10">
      <h1 className="text-base font-medium text-[var(--color-text)]">Settings</h1>

      <SettingsForm
        initial={{
          timezone: settings.timezone,
          theme: settings.theme as "light" | "dark" | "system",
        }}
      />

      <div className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-6">
        <ExportLink />
        <SignOutButton />
      </div>
    </div>
  );
}
