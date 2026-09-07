import { describe, expect, it } from "vitest";
import { SessionStatus } from "@/generated/prisma/enums";
import { InvalidTransitionError } from "@/server/domain/timer/errors";
import { nextStatus } from "@/server/domain/timer/transitions";

describe("nextStatus", () => {
  it.each([
    [SessionStatus.ACTIVE, "PAUSE", SessionStatus.PAUSED],
    [SessionStatus.ACTIVE, "COMPLETE", SessionStatus.COMPLETED],
    [SessionStatus.ACTIVE, "CANCEL", SessionStatus.CANCELLED],
    [SessionStatus.PAUSED, "RESUME", SessionStatus.ACTIVE],
    [SessionStatus.PAUSED, "COMPLETE", SessionStatus.COMPLETED],
    [SessionStatus.PAUSED, "CANCEL", SessionStatus.CANCELLED],
  ] as const)("%s --%s--> %s", (from, event, expected) => {
    expect(nextStatus(from, event)).toBe(expected);
  });

  it.each([
    [SessionStatus.ACTIVE, "RESUME"], // already running
    [SessionStatus.PAUSED, "PAUSE"], // already paused
    [SessionStatus.COMPLETED, "PAUSE"],
    [SessionStatus.COMPLETED, "RESUME"],
    [SessionStatus.COMPLETED, "COMPLETE"],
    [SessionStatus.COMPLETED, "CANCEL"],
    [SessionStatus.CANCELLED, "PAUSE"],
    [SessionStatus.CANCELLED, "RESUME"],
    [SessionStatus.CANCELLED, "COMPLETE"],
    [SessionStatus.CANCELLED, "CANCEL"],
  ] as const)("rejects %s --%s-->", (from, event) => {
    expect(() => nextStatus(from, event)).toThrow(InvalidTransitionError);
  });

  it("carries the offending state and event on the thrown error", () => {
    try {
      nextStatus(SessionStatus.COMPLETED, "PAUSE");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidTransitionError);
      expect((e as InstanceType<typeof InvalidTransitionError>).from).toBe(SessionStatus.COMPLETED);
      expect((e as InstanceType<typeof InvalidTransitionError>).event).toBe("PAUSE");
    }
  });
});
