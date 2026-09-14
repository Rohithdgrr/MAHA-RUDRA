import { describe, expect, it } from "vitest";
import { abCompare, flagRegression, relativeChange, variantScore } from "./regression";

describe("relativeChange", () => {
  it("computes rises and drops", () => {
    expect(relativeChange(100, 120)).toBeCloseTo(0.2);
    expect(relativeChange(100, 80)).toBeCloseTo(-0.2);
    expect(relativeChange(100, 100)).toBe(0);
  });
  it("never returns NaN", () => {
    expect(relativeChange(0, 0)).toBe(0);
    expect(relativeChange(0, 50)).toBe(Number.POSITIVE_INFINITY);
    expect(relativeChange(100, -5)).toBe(0);
  });
});

describe("flagRegression", () => {
  it("flags rises over 15% only", () => {
    expect(flagRegression(1000, 1200).regressed).toBe(true);
    expect(flagRegression(1000, 1150).regressed).toBe(false);
    expect(flagRegression(1000, 900).regressed).toBe(false);
  });
  it("respects custom thresholds", () => {
    expect(flagRegression(100, 110, 0.05).regressed).toBe(true);
  });
});

describe("abCompare", () => {
  it("prefers higher success-per-token", () => {
    const a = { tasksSucceeded: 8, tasksTotal: 10, tokens: 1000 };
    const b = { tasksSucceeded: 8, tasksTotal: 10, tokens: 2000 };
    expect(abCompare(a, b).winner).toBe("a");
    expect(abCompare(b, a).winner).toBe("b");
  });
  it("rewards success rate, not raw volume", () => {
    const fewGood = { tasksSucceeded: 5, tasksTotal: 5, tokens: 5000 };
    const manyBad = { tasksSucceeded: 5, tasksTotal: 10, tokens: 1000 };
    expect(abCompare(fewGood, manyBad).winner).toBe("b");
  });
  it("ties empty variants instead of picking noise", () => {
    expect(abCompare({ tasksSucceeded: 0, tasksTotal: 0, tokens: 0 }, { tasksSucceeded: 0, tasksTotal: 0, tokens: 0 }).winner).toBe("tie");
  });
  it("variantScore guards zero denominators", () => {
    expect(variantScore({ tasksSucceeded: 1, tasksTotal: 0, tokens: 5 })).toBe(0);
    expect(variantScore({ tasksSucceeded: 1, tasksTotal: 1, tokens: 0 })).toBe(0);
  });
});
