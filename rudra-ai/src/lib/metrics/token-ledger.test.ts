import { describe, expect, it } from "vitest";
import {
  cacheHitRate,
  capLedgers,
  emptyLedger,
  ledgerTotal,
  mergeLedgers,
  recordTask,
  recordUsage,
  resetReported,
  restoreLedger,
  successPerKiloToken,
  syncStepFinish,
  tokensPerTask,
} from "./token-ledger";

describe("recordUsage", () => {
  it("accumulates tokens + cost per bucket immutably", () => {
    const l0 = emptyLedger("s1");
    const l1 = recordUsage(l0, "output", 100, { cost: 0.01 });
    expect(l1.buckets.output).toMatchObject({ tokens: 100, cost: 0.01 });
    expect(l0.buckets.output.tokens).toBe(0);
    const l2 = recordUsage(l1, "output", 50);
    expect(l2.buckets.output.tokens).toBe(150);
  });
  it("ignores negative/NaN/zero without throwing", () => {
    const l0 = emptyLedger("s");
    expect(recordUsage(l0, "output", -5)).toBe(l0);
    expect(recordUsage(l0, "output", NaN)).toBe(l0);
    expect(recordUsage(l0, "output", 0)).toBe(l0);
  });
});

describe("syncStepFinish", () => {
  it("routes input→unattributed, output→output, cached→cached", () => {
    const l = syncStepFinish(emptyLedger("s"), { inputTokens: 1000, outputTokens: 200, cachedTokens: 400, cost: 0.02 });
    expect(l.buckets.unattributed.tokens).toBe(1000);
    expect(l.buckets.unattributed.cost).toBe(0.02);
    expect(l.buckets.output.tokens).toBe(200);
    expect(l.buckets.cached.tokens).toBe(400);
  });
  it("tolerates missing/zero turns", () => {
    const l0 = emptyLedger("s");
    expect(syncStepFinish(l0, { inputTokens: 0, outputTokens: 0 })).toMatchObject({ sessionID: "s" });
  });
});

describe("resetReported", () => {
  it("rebuilds reported buckets, preserves estimated ones", () => {
    let l = recordUsage(emptyLedger("s"), "system", 800, { source: "estimated" });
    l = syncStepFinish(l, { inputTokens: 500, outputTokens: 50 });
    const r = resetReported(l, { unattributed: { tokens: 100, cost: 0 }, output: { tokens: 10, cost: 0 } });
    expect(r.buckets.unattributed.tokens).toBe(100);
    expect(r.buckets.output.tokens).toBe(10);
    expect(r.buckets.system.tokens).toBe(800);
  });
});

describe("tasks + derived metrics", () => {
  it("tokensPerTask needs a success; counts totals", () => {
    let l = emptyLedger("s");
    expect(tokensPerTask(l)).toBeUndefined();
    l = recordUsage(l, "output", 1000);
    l = recordTask(l, false);
    expect(tokensPerTask(l)).toBeUndefined();
    expect(l.tasksTotal).toBe(1);
    l = recordTask(l, true);
    expect(tokensPerTask(l)).toBe(1000);
    expect(successPerKiloToken(l)).toBeCloseTo(1);
  });
  it("successPerKiloToken undefined with no tokens", () => {
    expect(successPerKiloToken(emptyLedger("s"))).toBeUndefined();
  });
  it("mergeLedgers sums counters and buckets", () => {
    const a = recordTask(recordUsage(emptyLedger("a"), "output", 100), true);
    const b = recordTask(recordUsage(emptyLedger("b"), "output", 300), false);
    const m = mergeLedgers([a, b]);
    expect(ledgerTotal(m).tokens).toBe(400);
    expect(m.tasksTotal).toBe(2);
    expect(m.tasksSucceeded).toBe(1);
  });
});

describe("cacheHitRate", () => {
  it("shares cached over input, capped at 1, undefined when empty", () => {
    expect(cacheHitRate(emptyLedger("s"))).toBeUndefined();
    const l = syncStepFinish(emptyLedger("s"), { inputTokens: 1000, outputTokens: 10, cachedTokens: 750 });
    expect(cacheHitRate(l)).toBe(0.75);
  });
});

describe("capLedgers + restoreLedger", () => {
  it("keeps newest N", () => {
    const ls = [1, 2, 3].map((i) => ({ ...emptyLedger(`s${i}`), updatedAt: i }));
    expect(capLedgers(ls, 2).map((l) => l.sessionID)).toEqual(["s3", "s2"]);
  });
  it("restores valid snapshots, drops corrupt ones", () => {
    const l = recordTask(recordUsage(emptyLedger("s"), "output", 42, { cost: 0.001 }), true);
    const json = JSON.parse(JSON.stringify(l)) as unknown;
    expect(restoreLedger(json)?.buckets.output.tokens).toBe(42);
    expect(restoreLedger(null)).toBeUndefined();
    expect(restoreLedger({ sessionID: "" })).toBeUndefined();
    expect(restoreLedger("{corrupt")).toBeUndefined();
    expect(restoreLedger({ sessionID: "x", buckets: null })).toBeUndefined();
  });
});
