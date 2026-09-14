import { describe, expect, it } from "vitest";
import { ContentCache, ToolCallCache, formatUnchanged, shortHash } from "./content-cache";

describe("ContentCache", () => {
  it("returns fresh first, unchanged marker on identical re-read", () => {
    const c = new ContentCache();
    const first = c.check("src/a.ts", "const x = 1;", 4);
    expect(first.status).toBe("fresh");
    const second = c.check("src/a.ts", "const x = 1;", 9);
    expect(second.status).toBe("unchanged");
    if (second.status === "unchanged") {
      expect(second.marker).toBe("src/a.ts (unchanged since turn 4, hash " + `${shortHash("const x = 1;").slice(0, 8)})`);
    }
  });
  it("detects changed content as fresh again", () => {
    const c = new ContentCache();
    c.check("a.ts", "v1", 1);
    const r = c.check("a.ts", "v2", 2);
    expect(r.status).toBe("fresh");
  });
  it("invalidate forces fresh; clear empties", () => {
    const c = new ContentCache();
    c.check("a.ts", "v1", 1);
    c.invalidate(["a.ts"]);
    expect(c.check("a.ts", "v1", 2).status).toBe("fresh");
    c.clear();
    expect(c.size()).toBe(0);
  });
  it("normalizes backslash paths", () => {
    const c = new ContentCache();
    c.check("src\\a.ts", "x", 1);
    const r = c.check("src/a.ts", "x", 2);
    expect(r.status).toBe("unchanged");
  });
  it("formatUnchanged is ~15 tokens", () => {
    expect(formatUnchanged("src/api.ts", "a3f9c1", 4).length).toBeLessThan(80);
  });
});

describe("ToolCallCache", () => {
  it("hits on identical args, misses on different ones", () => {
    const c = new ToolCallCache();
    expect(c.get("env_audit", { a: 1 })).toBeUndefined();
    c.set("env_audit", { a: 1 }, "out", 3);
    expect(c.get("env_audit", { a: 1 })?.output).toBe("out");
    expect(c.get("env_audit", { a: 2 })).toBeUndefined();
    expect(c.get("other_tool", { a: 1 })).toBeUndefined();
  });
  it("key is stable across key order? documents JSON order semantics", () => {
    // JSON.stringify is order-sensitive; same construction order hits.
    const k1 = ToolCallCache.key("t", { a: 1, b: 2 });
    expect(ToolCallCache.key("t", { a: 1, b: 2 })).toBe(k1);
  });
  it("truncates huge outputs and bounds entries", () => {
    const c = new ToolCallCache();
    c.set("t", {}, "x".repeat(50_000), 1);
    expect((c.get("t", {})?.output.length ?? 0)).toBeLessThanOrEqual(20_000);
    expect(ToolCallCache.hitNote(3)).toContain("turn 3");
  });
  it("handles unserializable args without throwing", () => {
    const c = new ToolCallCache();
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    expect(() => c.set("t", circular, "o", 1)).not.toThrow();
  });
});
