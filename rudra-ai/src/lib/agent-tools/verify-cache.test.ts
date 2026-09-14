import { describe, expect, it } from "vitest";
import { VerificationCache, fileHashes, transitiveDeps } from "./verify-cache";
import { buildImportGraph } from "./import-graph";

const entries = [
  { path: "src/foo.ts", content: "export const a = 1;" },
  { path: "src/bar.ts", content: "import {a} from './foo';" },
  { path: "src/foo.test.ts", content: "import {a} from './foo';" },
  { path: "src/other.test.ts", content: "const x = 1;" },
];

describe("fileHashes + transitiveDeps", () => {
  it("hashes by normalized path", () => {
    expect(fileHashes(entries).size).toBe(4);
  });
  it("walks forward imports only", () => {
    const g = buildImportGraph(entries);
    const deps = transitiveDeps(g, "src/foo.test.ts");
    expect(deps.has("src/foo.ts")).toBe(true);
    expect(deps.has("src/bar.ts")).toBe(false);
    expect(transitiveDeps(g, "missing.ts").size).toBe(1);
  });
});

describe("VerificationCache", () => {
  it("misses cold, hits on identical rerun", () => {
    const c = new VerificationCache();
    expect(c.check("src/foo.test.ts", entries)).toBeUndefined();
    c.record("src/foo.test.ts", entries, true, "3 passed");
    expect(c.check("src/foo.test.ts", entries)).toMatchObject({ passed: true, summary: "3 passed" });
  });
  it("misses when the test file changes", () => {
    const c = new VerificationCache();
    c.record("src/foo.test.ts", entries, true, "ok");
    const changed = entries.map((e) => (e.path === "src/foo.test.ts" ? { ...e, content: e.content + "\n// x" } : e));
    expect(c.check("src/foo.test.ts", changed)).toBeUndefined();
  });
  it("misses when a transitive dep changes, holds on unrelated edits", () => {
    const c = new VerificationCache();
    c.record("src/foo.test.ts", entries, true, "ok");
    c.record("src/other.test.ts", entries, true, "ok");
    const depChanged = entries.map((e) => (e.path === "src/foo.ts" ? { ...e, content: "export const a = 2;" } : e));
    expect(c.check("src/foo.test.ts", depChanged)).toBeUndefined();
    expect(c.check("src/other.test.ts", depChanged)).toMatchObject({ passed: true });
  });
  it("invalidate drops only affected tests", () => {
    const c = new VerificationCache();
    c.record("src/foo.test.ts", entries, true, "ok");
    c.record("src/other.test.ts", entries, true, "ok");
    expect(c.invalidate(["src/foo.ts"])).toEqual(["src/foo.test.ts"]);
    expect(c.check("src/other.test.ts", entries)).toMatchObject({ passed: true });
    expect(c.size()).toBe(1);
  });
  it("records failures too (negative verdicts cache)", () => {
    const c = new VerificationCache();
    c.record("src/foo.test.ts", entries, false, "1 failed: [x]");
    expect(c.check("src/foo.test.ts", entries)?.passed).toBe(false);
  });
  it("normalizes backslash test paths", () => {
    const c = new VerificationCache();
    c.record("src\\foo.test.ts", entries, true, "ok");
    expect(c.check("src/foo.test.ts", entries)).toMatchObject({ passed: true });
  });
});
