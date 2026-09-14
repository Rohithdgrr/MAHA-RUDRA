import { describe, expect, it } from "vitest";
import { buildMemoryBlock, mergeSystemPrompt } from "./inject";
import type { Memory } from "./types";

const T0 = 1_700_000_000_000;
const FRESH = Date.now();
function mem(partial: Partial<Memory> = {}): Memory {
  return {
    id: partial.id ?? `m_${Math.random()}`,
    category: "identity",
    key: "name",
    value: "Rohith",
    confidence: 1,
    status: "active",
    sensitive: false,
    source: { sessionId: "s", messageId: "m", excerpt: "e", timestamp: FRESH },
    createdAt: FRESH,
    updatedAt: FRESH,
    lastConfirmedAt: FRESH,
    ...partial,
  } as Memory;
}

describe("buildMemoryBlock", () => {
  it("returns empty when nothing is active", () => {
    const r = buildMemoryBlock([mem({ status: "archived" })]);
    expect(r.block).toBe("");
    expect(r.used).toEqual([]);
  });

  it("excludes sensitive unless opted in", () => {
    const s = mem({ id: "s", category: "contact", key: "email", value: "a@b.c", sensitive: true });
    expect(buildMemoryBlock([s]).block).toBe("");
    expect(buildMemoryBlock([s], { includeSensitive: true }).used).toHaveLength(1);
  });

  it("skips stale non-identity but keeps stale identity", () => {
    const old = T0 - 200 * 24 * 60 * 60 * 1000;
    const stalePref = mem({ id: "p", category: "preferences", key: "editor", value: "vim", lastConfirmedAt: old });
    const staleId = mem({ id: "i", key: "name", value: "Rohith", lastConfirmedAt: old });
    const r = buildMemoryBlock([stalePref, staleId], { now: T0 });
    expect(r.used.map((m) => m.id)).toEqual(["i"]);
    expect(r.dropped).toMatchObject([{ id: "p", reason: "stale" }]);
  });

  it("ranks identity first and truncates to budget", () => {
    const ms = [
      mem({ id: "c", category: "custom", key: "note", value: "x".repeat(200) }),
      mem({ id: "i", category: "identity", key: "name", value: "Rohith" }),
    ];
    const r = buildMemoryBlock(ms, { budgetTokens: 20 });
    expect(r.used[0]?.id).toBe("i");
    expect(r.dropped.some((d) => d.reason === "budget")).toBe(true);
  });

  it("caps resume entries at 3", () => {
    const ms = Array.from({ length: 5 }, (_, i) =>
      mem({ id: `r${i}`, category: "resume", key: `job.${i}`, value: `Job ${i}` }),
    );
    const r = buildMemoryBlock(ms, { budgetTokens: 800 });
    expect(r.used).toHaveLength(3);
    expect(r.block).toContain("more resume/CV entries");
  });
});

describe("mergeSystemPrompt", () => {
  it("keeps both, persona first", () => {
    expect(mergeSystemPrompt("persona", "## About")).toBe("persona\n\n## About");
    expect(mergeSystemPrompt(undefined, "## About")).toBe("## About");
    expect(mergeSystemPrompt("persona", "")).toBe("persona");
    expect(mergeSystemPrompt()).toBeUndefined();
  });
});
