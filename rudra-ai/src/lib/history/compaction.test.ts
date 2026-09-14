import { describe, expect, it } from "vitest";
import {
  anchorsFromScratchpad,
  compactTurns,
  compressTurn,
  renderCompacted,
  slidingWindow,
  type HistoryTurn,
} from "./compaction";

const turns: HistoryTurn[] = [
  { role: "user", text: "fix the login bug" },
  { role: "tool", tool: "search_symbols", text: "found 3 refs", verdict: "pass" },
  { role: "assistant", text: "I will edit auth.ts now" },
  { role: "tool", tool: "run_verify", text: "1 failed", verdict: "fail" },
  { role: "assistant", text: "retrying with a different approach" },
  { role: "tool", tool: "run_verify", text: "all green", verdict: "pass" },
];

describe("anchorsFromScratchpad", () => {
  it("picks known keys, trims, drops empties", () => {
    const a = anchorsFromScratchpad({ goal: " ship it ", plan: "", decisions: "use axum", unknown: "x" });
    expect(a).toMatchObject({ goal: "ship it", plan: undefined, decisions: "use axum", failedAttempts: undefined });
  });
});

describe("compressTurn", () => {
  it("marks tool verdicts and collapses whitespace", () => {
    expect(compressTurn({ role: "tool", tool: "run_verify", text: "line1\n  line2", verdict: "pass" })).toMatch(/^✓ run_verify: /);
    expect(compressTurn({ role: "tool", text: "x", verdict: "fail" })).toMatch(/^× tool: /);
    expect(compressTurn({ role: "user", text: "hi" })).toBe("user: hi");
  });
});

describe("compactTurns", () => {
  it("keeps recent turns verbatim, summarizes the rest", () => {
    const c = compactTurns(turns, { goal: "fix login" }, 2);
    expect(c.kept).toHaveLength(2);
    expect(c.dropped).toBe(4);
    expect(c.summary).toHaveLength(4);
    expect(c.anchors.goal).toBe("fix login");
  });
  it("short histories pass through untouched", () => {
    const c = compactTurns(turns.slice(0, 2), {}, 4);
    expect(c.summary).toEqual([]);
    expect(c.dropped).toBe(0);
  });
  it("tolerates bad keepRecent", () => {
    expect(compactTurns(turns, {}, -1).kept.length).toBeGreaterThan(0);
  });
});

describe("slidingWindow", () => {
  it("returns current + last N tool results (deduped when current is a tool)", () => {
    // fixture ends with a tool turn, so it doubles as current.
    const w1 = slidingWindow(turns, 1);
    expect(w1[w1.length - 1]).toBe(turns[turns.length - 1]);
    expect(w1).toHaveLength(1);
    const w2 = slidingWindow(turns, 2);
    expect(w2).toHaveLength(2);
    expect(w2.every((t) => t.role === "tool")).toBe(true);
  });
  it("handles empty and zero counts", () => {
    expect(slidingWindow([], 2)).toEqual([]);
    const w0 = slidingWindow(turns, 0);
    expect(w0).toHaveLength(1);
    expect(w0[0]).toBe(turns[turns.length - 1]);
  });
});

describe("renderCompacted", () => {
  it("renders anchors first in frozen order", () => {
    const text = renderCompacted(compactTurns(turns, { goal: "g", plan: "p", decisions: "d", failedAttempts: "f" }, 1));
    const order = ["Goal:", "Plan:", "Decisions:", "Failed", "Earlier"].map((h) => text.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it("empty compaction renders empty", () => {
    expect(renderCompacted(compactTurns([], {}, 4))).toBe("");
  });
});
