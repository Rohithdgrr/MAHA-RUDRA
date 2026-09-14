import { describe, expect, it } from "vitest";
import { createUsageStore, memoryStorage, sumStepFinish } from "./usage-store";
import { METRICS_STORAGE_KEY } from "./usage-store";

function parts() {
  return [
    { type: "text", text: "hi" },
    { type: "step-finish", tokens: { input: 1000, output: 200 }, cost: 0.01 },
    { type: "step-finish", tokens: { input: 500, output: 100, cached: 300 }, cost: 0.005 },
    "garbage",
    null,
  ];
}

describe("sumStepFinish", () => {
  it("sums step-finish turns only, tolerates junk", () => {
    expect(sumStepFinish(parts())).toEqual({ input: 1500, output: 300, reasoning: 0, cached: 300, cacheWrite: 0, cost: 0.015 });
    expect(sumStepFinish(undefined)).toEqual({ input: 0, output: 0, reasoning: 0, cached: 0, cacheWrite: 0, cost: 0 });
    expect(sumStepFinish("nope")).toEqual({ input: 0, output: 0, reasoning: 0, cached: 0, cacheWrite: 0, cost: 0 });
  });
  it("routes server reasoning + cache.read/write shapes", () => {
    expect(
      sumStepFinish([{ type: "step-finish", tokens: { input: 100, output: 10, reasoning: 40, cache: { read: 60, write: 20 } }, cost: 0.001 }]),
    ).toEqual({ input: 100, output: 10, reasoning: 40, cached: 60, cacheWrite: 20, cost: 0.001 });
  });
  it("ignores non-positive values", () => {
    expect(sumStepFinish([{ type: "step-finish", tokens: { input: -5, output: NaN }, cost: -1 }])).toEqual({
      input: 0,
      output: 0,
      reasoning: 0,
      cached: 0,
      cacheWrite: 0,
      cost: 0,
    });
  });
});

describe("usageStore.syncSession", () => {
  it("rebuilds reported buckets idempotently", () => {
    const s = createUsageStore(memoryStorage());
    const msgs = [{ parts: parts() }];
    s.syncSession("s1", msgs);
    const first = s.state.ledgers["s1"];
    s.syncSession("s1", msgs);
    expect(s.state.ledgers["s1"]).toEqual(first);
    expect(first?.buckets.unattributed.tokens).toBe(1500);
    expect(first?.buckets.output.tokens).toBe(300);
    expect(first?.buckets.cached.tokens).toBe(300);
  });
  it("routes reasoning and cache.read into their buckets", () => {
    const s = createUsageStore(memoryStorage());
    s.syncSession("s1", [
      { parts: [{ type: "step-finish", tokens: { input: 200, output: 20, reasoning: 50, cache: { read: 120, write: 30 } } }] },
    ]);
    expect(s.state.ledgers["s1"]?.buckets.reasoning.tokens).toBe(50);
    expect(s.state.ledgers["s1"]?.buckets.cached.tokens).toBe(120);
    expect(s.state.ledgers["s1"]?.buckets.unattributed.tokens).toBe(200);
  });
  it("preserves estimated buckets across syncs", () => {
    const s = createUsageStore(memoryStorage());
    s.reportMemoryBlock("s1", "abcdefgh");
    s.syncSession("s1", [{ parts: parts() }]);
    expect(s.state.ledgers["s1"]?.buckets.system.tokens).toBe(2);
  });
});

describe("usageStore estimates + tasks", () => {
  it("reportMemoryBlock feeds system bucket; blanks ignored", () => {
    const s = createUsageStore(memoryStorage());
    s.reportMemoryBlock("s1", "   ");
    expect(s.state.ledgers["s1"]).toBeUndefined();
    s.reportMemoryBlock("s1", "abcd");
    expect(s.state.ledgers["s1"]?.buckets.system).toMatchObject({ tokens: 1, source: "estimated" });
  });
  it("reportToolCall feeds tools/tool_out + ranking", () => {
    const s = createUsageStore(memoryStorage());
    s.reportToolCall("s1", "run_verify", "abcd", "abcdefgh", true);
    expect(s.state.ledgers["s1"]?.buckets.tools.tokens).toBe(1);
    expect(s.state.ledgers["s1"]?.buckets.tool_out.tokens).toBe(2);
    expect(s.state.toolStats).toHaveLength(1);
  });
  it("reportTask + global aggregate", () => {
    const s = createUsageStore(memoryStorage());
    s.syncSession("s1", [{ parts: parts() }]);
    s.reportTask("s1", true);
    const g = s.global();
    expect(g.tasksSucceeded).toBe(1);
    expect(g.tokens).toBe(1500 + 300 + 300);
    expect(g.perTask).toBe(g.tokens);
  });
  it("global on empty store", () => {
    const s = createUsageStore(memoryStorage());
    expect(s.global()).toMatchObject({ tokens: 0, perTask: undefined });
  });
});

describe("usageStore persistence", () => {
  it("round-trips through storage; corrupt payloads recover", () => {
    const storage = memoryStorage();
    const s = createUsageStore(storage);
    s.reportMemoryBlock("s1", "abcd");
    s.reportTask("s1", true);
    s.setBaseline("global", 500);
    const raw = storage.getItem(METRICS_STORAGE_KEY);
    expect(raw).toContain("s1");
    const s2 = createUsageStore(storage);
    expect(s2.state.ledgers["s1"]?.buckets.system.tokens).toBe(1);
    expect(s2.state.baselines["global"]).toBe(500);
    storage.setItem(METRICS_STORAGE_KEY, "{corrupt");
    expect(createUsageStore(storage).global().tokens).toBe(0);
  });
  it("rejects bad baselines", () => {
    const s = createUsageStore(memoryStorage());
    s.setBaseline("  ", 100);
    s.setBaseline("global", -5);
    s.setBaseline("global", NaN);
    expect(s.state.baselines).toEqual({});
  });
});
