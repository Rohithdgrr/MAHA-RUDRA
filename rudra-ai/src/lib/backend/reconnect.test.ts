import { describe, expect, it } from "vitest";
import { RECONNECT_BASE_MS, RECONNECT_CAP_MS, nextReconnectDelay } from "./reconnect";

const exact = (n: number) => nextReconnectDelay(n, () => 0.5);

describe("nextReconnectDelay", () => {
  it("starts at the base and doubles", () => {
    expect(exact(0)).toBe(RECONNECT_BASE_MS);
    expect(exact(1)).toBe(RECONNECT_BASE_MS * 2);
    expect(exact(2)).toBe(RECONNECT_BASE_MS * 4);
  });

  it("caps at 30s", () => {
    expect(exact(10)).toBe(RECONNECT_CAP_MS);
    expect(exact(100)).toBe(RECONNECT_CAP_MS);
  });

  it("jitters within ±25%", () => {
    for (let i = 0; i < 50; i++) {
      const d = nextReconnectDelay(2);
      expect(d).toBeGreaterThanOrEqual(3000);
      expect(d).toBeLessThanOrEqual(5000);
    }
    expect(nextReconnectDelay(0, () => 0)).toBe(750);
    expect(nextReconnectDelay(0, () => 1)).toBe(1250);
  });

  it("clamps garbage attempts", () => {
    expect(exact(-3)).toBe(RECONNECT_BASE_MS);
    expect(exact(NaN)).toBe(RECONNECT_BASE_MS);
  });
});
