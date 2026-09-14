import { describe, expect, it } from "vitest";
import { measureToolIO, rankTools, recordToolCall, restoreToolStats } from "./tool-efficiency";

describe("recordToolCall", () => {
  it("accumulates per-tool counters immutably", () => {
    const s0 = recordToolCall([], "run_verify", 100, 500, true);
    expect(s0).toHaveLength(1);
    const s1 = recordToolCall(s0, "run_verify", 100, 100, false);
    expect(s1[0]).toMatchObject({ calls: 2, tokensIn: 200, tokensOut: 600, useful: 1 });
    expect(s0[0]?.calls).toBe(1);
  });
  it("sanitizes bad numbers and blank names", () => {
    const s = recordToolCall([], "  ", NaN, -3, false);
    expect(s[0]).toMatchObject({ tool: "unknown", tokensIn: 0, tokensOut: 0, useful: 0 });
  });
});

describe("measureToolIO", () => {
  it("estimates from text length", () => {
    const m = measureToolIO("abcd", "abcdefgh");
    expect(m).toEqual({ tokensIn: 1, tokensOut: 2 });
    expect(measureToolIO("", "")).toEqual({ tokensIn: 0, tokensOut: 0 });
  });
});

describe("rankTools", () => {
  it("ranks zero-useful tools first, then highest cost per useful", () => {
    const ranked = rankTools([
      { tool: "cheap", calls: 10, tokensIn: 100, tokensOut: 100, useful: 10 },
      { tool: "wasteful", calls: 2, tokensIn: 5000, tokensOut: 5000, useful: 0 },
      { tool: "pricey", calls: 1, tokensIn: 900, tokensOut: 100, useful: 1 },
    ]);
    expect(ranked.map((r) => r.tool)).toEqual(["wasteful", "pricey", "cheap"]);
    expect(ranked[1]?.tokensPerUseful).toBe(1000);
    expect(ranked[0]?.tokensPerUseful).toBeUndefined();
  });
  it("handles empty input", () => {
    expect(rankTools([])).toEqual([]);
  });
});

describe("restoreToolStats", () => {
  it("drops corrupt entries", () => {
    const good = { tool: "a", calls: 1, tokensIn: 1, tokensOut: 1, useful: 1 };
    expect(restoreToolStats([good, null, { tool: "", calls: 1, tokensIn: 0, tokensOut: 0, useful: 0 }])).toEqual([good]);
    expect(restoreToolStats("nope")).toEqual([]);
    expect(restoreToolStats(null)).toEqual([]);
  });
});
