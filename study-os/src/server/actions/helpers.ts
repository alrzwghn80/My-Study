import "server-only";
import { auth } from "@/server/auth";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user.id;
}

/** Turns a thrown domain error into UI-safe text — never leaks stack traces or raw Prisma errors to the client. */
export function toActionError(e: unknown): string {
  if (e instanceof RangeError) return e.message;
  if (e instanceof Error) {
    // Domain errors (InvalidTransitionError, SessionAlreadyActiveError, etc.)
    // all have deliberately user-safe .message text — see docs/timer-state-machine.md.
    return e.message;
  }
  return "Something went wrong. Please try again.";
}
