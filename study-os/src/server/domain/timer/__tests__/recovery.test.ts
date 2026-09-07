import { describe, expect, it } from "vitest";
import { DEFAULT_STALE_THRESHOLD_SECONDS, evaluateRecovery } from "@/server/domain/timer/recovery";

const T0 = new Date("2026-01-15T12:00:00.000Z");

describe("evaluateRecovery", () => {
  it("is fresh when the heartbeat is recent", () => {
    const result = evaluateRecovery({
      now: T0,
      lastHeartbeatAt: new Date(T0.getTime() - 30_000),
      openIntervalStartedAt: new Date(T0.getTime() - 3600_000),
    });
    expect(result.stale).toBe(false);
  });

  it("is stale once the gap reaches the threshold", () => {
    const result = evaluateRecovery({
      now: T0,
      lastHeartbeatAt: new Date(T0.getTime() - DEFAULT_STALE_THRESHOLD_SECONDS * 1000),
      openIntervalStartedAt: new Date(T0.getTime() - 3600_000),
    });
    expect(result.stale).toBe(true);
  });

  it("is fresh one second under the threshold (exact boundary)", () => {
    const result = evaluateRecovery({
      now: T0,
      lastHeartbeatAt: new Date(T0.getTime() - (DEFAULT_STALE_THRESHOLD_SECONDS - 1) * 1000),
      openIntervalStartedAt: new Date(T0.getTime() - 3600_000),
    });
    expect(result.stale).toBe(false);
  });

  it("falls back to the open interval's start when there was never a heartbeat", () => {
    const openStart = new Date(T0.getTime() - 3600_000);
    const result = evaluateRecovery({ now: T0, lastHeartbeatAt: null, openIntervalStartedAt: openStart });
    expect(result.stale).toBe(true);
    if (result.stale) {
      expect(result.lastKnownGoodAt.getTime()).toBe(openStart.getTime());
      expect(result.gapSeconds).toBe(3600);
    }
  });

  it("respects a custom threshold (e.g. an 8-hour sleep with the default threshold)", () => {
    const result = evaluateRecovery({
      now: T0,
      lastHeartbeatAt: new Date(T0.getTime() - 8 * 3600_000),
      openIntervalStartedAt: new Date(T0.getTime() - 9 * 3600_000),
    });
    expect(result.stale).toBe(true);
    if (result.stale) expect(result.gapSeconds).toBe(8 * 3600);
  });

  it("reports the exact gap for the recovery prompt copy", () => {
    const result = evaluateRecovery({
      now: T0,
      lastHeartbeatAt: new Date(T0.getTime() - 600_000),
      openIntervalStartedAt: new Date(T0.getTime() - 3600_000),
    });
    expect(result.stale).toBe(true);
    if (result.stale) {
      expect(result.gapSeconds).toBe(600);
      expect(result.lastKnownGoodAt.getTime()).toBe(T0.getTime() - 600_000);
    }
  });
});
