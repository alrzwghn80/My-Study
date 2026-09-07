import type { ReactNode } from "react";
import { NavBar } from "@/components/NavBar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-bg)]">
      <NavBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 md:px-6">{children}</main>
    </div>
  );
}
