import { describe, expect, it } from "vitest";
import {
  buildImportGraph,
  extractSymbols,
  globMatch,
  pageRank,
  parseImportSpecs,
  resolveRelativeImport,
  reverseDeps,
} from "./import-graph";

describe("import-graph", () => {
  it("extracts TS exports with lines", () => {
    const syms = extractSymbols("src/a.ts", "export function foo() {}\nexport class Bar {}");
    expect(syms.map((s) => s.name)).toEqual(["foo", "Bar"]);
    expect(syms[0]?.line).toBe(1);
  });
  it("returns [] for unknown extensions and never throws", () => {
    expect(extractSymbols("README.md", "# hi")).toEqual([]);
    expect(parseImportSpecs("x.ts", "")).toEqual([]);
  });
  it("parses relative + bare imports, resolves relative only", () => {
    const entries = [
      { path: "src/a.ts", content: "import {b} from './b';\nimport z from 'zod';" },
      { path: "src/b.ts", content: "export const b = 1;" },
    ];
    const g = buildImportGraph(entries);
    expect(g.edges.get("src/a.ts")).toEqual(["src/b.ts"]);
    expect(g.reverse.get("src/b.ts")?.has("src/a.ts")).toBe(true);
  });
  it("resolveRelativeImport handles ../ and index files", () => {
    const known = new Set(["src/b.ts", "src/sub/index.ts"]);
    expect(resolveRelativeImport("src/a.ts", "./b", known)).toBe("src/b.ts");
    expect(resolveRelativeImport("src/a.ts", "./sub", known)).toBe("src/sub/index.ts");
    expect(resolveRelativeImport("src/a.ts", "zod", known)).toBeNull();
    expect(resolveRelativeImport("src/a.ts", "./missing", known)).toBeNull();
  });
  it("reverseDeps respects depth and ignores unknown files", () => {
    const entries = [
      { path: "a.ts", content: "import './b'" },
      { path: "b.ts", content: "import './c'" },
      { path: "c.ts", content: "" },
    ];
    const g = buildImportGraph(entries);
    expect(reverseDeps(g, ["c.ts"], 1).has("b.ts")).toBe(true);
    expect(reverseDeps(g, ["c.ts"], 1).has("a.ts")).toBe(false);
    expect(reverseDeps(g, ["c.ts"], 5).has("a.ts")).toBe(true);
    expect(reverseDeps(g, ["nope.ts"], 2).size).toBe(0);
  });
  it("pageRank handles empty + circular graphs", () => {
    expect(pageRank({ files: [], edges: new Map(), reverse: new Map() }).size).toBe(0);
    const entries = [
      { path: "a.ts", content: "import './b'" },
      { path: "b.ts", content: "import './a'" },
    ];
    const g = buildImportGraph(entries);
    const r = pageRank(g);
    expect(r.get("a.ts")).toBeGreaterThan(0);
  });
  it("globMatch supports ** and *", () => {
    expect(globMatch("src/api/**", "src/api/a/b.ts")).toBe(true);
    expect(globMatch("src/*.ts", "src/a.ts")).toBe(true);
    expect(globMatch("src/*.ts", "src/a/b.ts")).toBe(false);
    expect(globMatch("**/*.test.ts", "src/a.test.ts")).toBe(true);
  });
});
