import Link from "next/link";
import { signOutAction } from "@/server/actions/auth-extra";

const LINKS = [
  { href: "/", label: "Dashboard", icon: "⏱" },
  { href: "/analytics", label: "Analytics", icon: "\u{1F4CA}" },
  { href: "/history", label: "History", icon: "\u{1F4C5}" },
  { href: "/goals", label: "Goals", icon: "\u{1F3AF}" },
  { href: "/settings", label: "Settings", icon: "⚙" },
] as const;

export function NavBar() {
  return (
    <>
      <header className="sticky top-0 z-30 hidden border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-semibold text-[var(--color-text)]">
            German Study OS
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-[var(--radius-sm)] px-3 py-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <nav
        aria-label="Main"
        className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-surface)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] text-[var(--color-text-muted)]"
          >
            <span aria-hidden="true" className="text-base">
              {link.icon}
            </span>
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
