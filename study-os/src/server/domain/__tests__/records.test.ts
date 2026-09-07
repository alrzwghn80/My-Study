import { describe, expect, it } from "vitest";
import { isChasingRecord } from "@/server/domain/records";

describe("isChasingRecord", () => {
  it("reports not-yet-broken with the exact remaining amount", () => {
    const result = isChasingRecord(5000, 8000);
    expect(result.broken).toBe(false);
    expect(result.remainingSeconds).toBe(3001);
  });

  it("reports broken once the current total exceeds the record", () => {
    const result = isChasingRecord(8001, 8000);
    expect(result.broken).toBe(true);
    expect(result.remainingSeconds).toBe(0);
  });

  it("is not broken by merely tying the record — must exceed it", () => {
    const result = isChasingRecord(8000, 8000);
    expect(result.broken).toBe(false);
  });
});
