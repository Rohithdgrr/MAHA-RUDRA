import { describe, expect, it } from "vitest";
import { estimateTokens, formatTokens, sumUsage } from "./tokens";

describe("estimateTokens", () => {
  it("returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("   ")).toBe(0);
  });

  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("x".repeat(48))).toBe(12);
  });
});

describe("sumUsage", () => {
  it("sums step-finish tokens and cost only", () => {
    expect(
      sumUsage([
        { type: "text" },
        { type: "step-finish", tokens: { input: 100, output: 12 }, cost: 0.004 },
        { type: "step-finish", tokens: { input: 400 }, cost: 0.002 },
      ]),
    ).toEqual({ tokens: 512, cost: expect.closeTo(0.006, 9) });
  });

  it("tolerates missing fields", () => {
    expect(sumUsage([{ type: "step-finish" }])).toEqual({ tokens: 0, cost: 0 });
    expect(sumUsage([])).toEqual({ tokens: 0, cost: 0 });
  });
});

describe("formatTokens", () => {
  it("formats compactly", () => {
    expect(formatTokens(48)).toBe("48");
    expect(formatTokens(12400)).toBe("12.4k");
    expect(formatTokens(128000)).toBe("128k");
  });
});
