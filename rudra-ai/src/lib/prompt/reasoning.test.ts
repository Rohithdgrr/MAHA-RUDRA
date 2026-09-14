import { describe, expect, it } from "vitest";
import {
  REASONING_BUDGETS,
  budgetFor,
  buildPlanSkeleton,
  classifyComplexity,
  parsePlanSkeleton,
  sampleCount,
} from "./reasoning";

describe("classifyComplexity + budgetFor", () => {
  it("mechanical work gets zero thinking budget", () => {
    expect(classifyComplexity("extract")).toBe("mechanical");
    expect(budgetFor("extract")).toBe(0);
    expect(REASONING_BUDGETS.mechanical).toBe(0);
  });
  it("novel debugging gets full budget, routine edits light", () => {
    expect(classifyComplexity("debug")).toBe("full");
    expect(budgetFor("debug")).toBe(4000);
    expect(classifyComplexity("edit")).toBe("light");
    expect(budgetFor("refactor")).toBe(500);
  });
});

describe("buildPlanSkeleton + parsePlanSkeleton", () => {
  it("round-trips structured plans", () => {
    const raw = buildPlanSkeleton("fix login", ["find call sites", "patch"], ["breaks sso"]);
    const p = parsePlanSkeleton(raw);
    expect(p).toMatchObject({ goal: "fix login", chosen: 0 });
    expect(p?.steps).toHaveLength(2);
  });
  it("validates inputs", () => {
    expect(() => buildPlanSkeleton("  ", ["x"])).toThrow();
    expect(() => buildPlanSkeleton("g", [])).toThrow();
    expect(parsePlanSkeleton("not json")).toBeUndefined();
    expect(parsePlanSkeleton('{"goal":"","steps":[]}')).toBeUndefined();
    expect(parsePlanSkeleton('{"goal":"g","steps":["a"],"chosen":9}')).toMatchObject({ chosen: 0 });
  });
  it("caps steps and risks", () => {
    const raw = buildPlanSkeleton("g", Array.from({ length: 20 }, (_, i) => `s${i}`), Array.from({ length: 9 }, (_, i) => `r${i}`));
    const p = parsePlanSkeleton(raw);
    expect(p?.steps).toHaveLength(10);
    expect(p?.risks).toHaveLength(5);
  });
});

describe("sampleCount", () => {
  it("single pass unless high-stakes judgment work", () => {
    expect(sampleCount("edit", false)).toBe(1);
    expect(sampleCount("extract", true)).toBe(1);
    expect(sampleCount("refactor", true)).toBe(3);
    expect(sampleCount("ambiguous-intent", true)).toBe(3);
  });
});
