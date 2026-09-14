import { describe, expect, it } from "vitest";
import {
  ConvergenceTracker,
  DEFAULT_BUDGET,
  VerifiedState,
  checkBudget,
  getFailedAttempts,
  recordFailedAttempt,
  renderFailedAttempts,
} from "./loop-guards";
import { MemoryKV } from "./scratchpad";

describe("failed attempts", () => {
  it("records, reads back, and renders for injection", () => {
    const kv = new MemoryKV();
    expect(renderFailedAttempts(kv)).toBe("");
    recordFailedAttempt(kv, "bump zod", "breaks build: ESM import");
    recordFailedAttempt(kv, "patch regex", "still misses unicode");
    const list = getFailedAttempts(kv);
    expect(list).toHaveLength(2);
    const rendered = renderFailedAttempts(kv);
    expect(rendered).toContain("bump zod");
    expect(rendered).toContain("do not retry");
  });
  it("dedupes identical consecutive retries", () => {
    const kv = new MemoryKV();
    recordFailedAttempt(kv, "x", "y");
    recordFailedAttempt(kv, "x", "y");
    expect(getFailedAttempts(kv)).toHaveLength(1);
  });
  it("rejects empties and caps at 20", () => {
    const kv = new MemoryKV();
    expect(recordFailedAttempt(kv, "  ", "y")).toEqual([]);
    for (let i = 0; i < 25; i++) recordFailedAttempt(kv, `t${i}`, `f${i}`);
    expect(getFailedAttempts(kv)).toHaveLength(20);
    expect(getFailedAttempts(kv)[0]?.tried).toBe("t5");
  });
  it("corrupt payloads yield [] without throwing", () => {
    const kv = new MemoryKV();
    kv.set("scratchpad:failed_attempts", "{oops");
    expect(getFailedAttempts(kv)).toEqual([]);
    kv.set("scratchpad:failed_attempts", `"just a string"`);
    expect(getFailedAttempts(kv)).toEqual([]);
  });
});

describe("checkBudget", () => {
  it("ok → wrap-up → exceeded at 20/25", () => {
    expect(checkBudget(DEFAULT_BUDGET, 0)).toBe("ok");
    expect(checkBudget(DEFAULT_BUDGET, 19)).toBe("ok");
    expect(checkBudget(DEFAULT_BUDGET, 20)).toBe("wrap-up");
    expect(checkBudget(DEFAULT_BUDGET, 25)).toBe("exceeded");
    expect(checkBudget(DEFAULT_BUDGET, 99)).toBe("exceeded");
  });
  it("tolerates garbage", () => {
    expect(checkBudget(DEFAULT_BUDGET, NaN)).toBe("ok");
    expect(checkBudget(DEFAULT_BUDGET, -1)).toBe("ok");
  });
});

describe("ConvergenceTracker", () => {
  it("flags 3 consecutive failing edits to the same file", () => {
    const t = new ConvergenceTracker();
    expect(t.record("a.ts", false).thrashing).toBe(false);
    expect(t.record("a.ts", false).thrashing).toBe(false);
    const third = t.record("a.ts", false);
    expect(third).toMatchObject({ thrashing: true, streak: 3 });
  });
  it("a pass resets; other files don't count", () => {
    const t = new ConvergenceTracker();
    t.record("a.ts", false);
    t.record("a.ts", false);
    expect(t.record("a.ts", true).thrashing).toBe(false);
    expect(t.record("a.ts", false).streak).toBe(1);
    t.record("b.ts", false);
    expect(t.record("a.ts", false).streak).toBe(1);
  });
});

describe("VerifiedState", () => {
  it("skips re-verification while content matches", () => {
    const v = new VerifiedState();
    expect(v.isStillVerified("a.ts", "x")).toBe(false);
    v.markVerified("a.ts", "x");
    expect(v.isStillVerified("a.ts", "x")).toBe(true);
    expect(v.isStillVerified("a.ts", "y")).toBe(false);
    v.forget("a.ts");
    expect(v.isStillVerified("a.ts", "x")).toBe(false);
  });
});
