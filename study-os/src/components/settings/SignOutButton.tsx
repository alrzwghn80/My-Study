import { signOutAction } from "@/server/actions/auth-extra";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        Sign out
      </button>
    </form>
  );
}
