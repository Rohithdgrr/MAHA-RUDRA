import { describe, expect, it } from "vitest";
import { repoMap } from "./repo-map";
import { ToolError } from "./types";

describe("repoMap", () => {
  const entries = [
    { path: "src/api/users.ts", content: "import {db} from '../db';\nexport function getUser() {}\n" },
    { path: "src/db.ts", content: "export const db = {};" },
    { path: "node_modules/z/index.js", content: "export const z = 1;" },
  ];
  it("ranks dependency higher and skips node_modules", () => {
    const r = repoMap(entries, { maxTokens: 2000 });
    expect(r.markdown).toContain("src/db.ts");
    expect(r.markdown).not.toContain("node_modules");
    expect(r.filesRanked[0]).toBe("src/db.ts");
  });
  it("focus globs boost matching files", () => {
    const r = repoMap(entries, { focus: ["src/api/**"] });
    expect(r.filesRanked).toContain("src/api/users.ts");
  });
  it("truncates to maxTokens", () => {
    const big = Array.from({ length: 20 }, (_, i) => ({
      path: `src/f${i}.ts`,
      content: `export function f${i}() { return ${i}; }\n`,
    }));
    const r = repoMap(big, { maxTokens: 100 });
    expect(r.truncated).toBe(true);
    expect(r.tokensEstimate).toBeLessThanOrEqual(120);
  });
  it("empty repo returns placeholder", () => {
    const r = repoMap([], {});
    expect(r.filesRanked).toEqual([]);
    expect(r.markdown).toContain("empty");
  });
  it("rejects bad maxTokens", () => {
    expect(() => repoMap(entries, { maxTokens: 0 })).toThrow(ToolError);
    expect(() => repoMap(entries, { maxTokens: NaN })).toThrow(ToolError);
  });
});
