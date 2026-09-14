import { describe, expect, it } from "vitest";
import { DocRegistry, fileRef, parseFileRef } from "./references";

describe("fileRef", () => {
  it("round-trips path + hash", () => {
    const ref = fileRef("src\\api.ts", "content");
    expect(ref).toMatch(/^src\/api\.ts@[a-z0-9]+$/);
    const parsed = parseFileRef(ref);
    expect(parsed?.path).toBe("src/api.ts");
    expect(typeof parsed?.hash).toBe("string");
  });
  it("rejects malformed refs", () => {
    expect(parseFileRef("no-at-sign")).toBeUndefined();
    expect(parseFileRef("a@")).toBeUndefined();
    expect(parseFileRef("@hash")).toBeUndefined();
    expect(parseFileRef("a@not a hash!")).toBeUndefined();
  });
  it("same content → same ref (dedup key)", () => {
    expect(fileRef("a.ts", "x")).toBe(fileRef("a.ts", "x"));
    expect(fileRef("a.ts", "x")).not.toBe(fileRef("a.ts", "y"));
  });
});

describe("DocRegistry", () => {
  it("registers and resolves, stable ids", () => {
    const r = new DocRegistry();
    const id = r.register("https://example.com/useEffect", "# useEffect\nbody");
    expect(id.startsWith("doc:")).toBe(true);
    expect(r.resolve(id)).toContain("useEffect");
    expect(r.register("https://example.com/useEffect", "# useEffect\nbody")).toBe(id);
    expect(r.has(id)).toBe(true);
    expect(r.resolve("doc:missing-xyz")).toBeUndefined();
  });
  it("truncates huge docs and bounds entries", () => {
    const r = new DocRegistry();
    const id = r.register("big", "x".repeat(100_000));
    expect((r.resolve(id)?.length ?? 0)).toBeLessThanOrEqual(40_000);
    for (let i = 0; i < 105; i++) r.register(`s${i}`, `doc ${i}`);
    expect(r.has(id)).toBe(false);
  });
});
