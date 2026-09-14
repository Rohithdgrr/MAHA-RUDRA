import { describe, expect, it } from "vitest";
import {
  lintTypecheck,
  parseCargoCheck,
  parseEslintJson,
  parseRuffJson,
  parseTscOutput,
} from "./lint-typecheck";

describe("lintTypecheck parsers", () => {
  it("parses tsc lines and skips garbage", () => {
    const d = parseTscOutput("src/a.ts(2,5): error TS2322: bad\nnot a diag\nsrc/b.ts(1,1): warning TS6133: unused");
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ file: "src/a.ts", line: 2, severity: "error", rule: "TS2322" });
  });
  it("parses eslint json tolerantly", () => {
    expect(parseEslintJson(null)).toEqual([]);
    const d = parseEslintJson([
      { filePath: "a.ts", messages: [{ line: 1, column: 2, severity: 2, ruleId: "semi", message: "x", fix: true }] },
    ]);
    expect(d[0]).toMatchObject({ severity: "error", autofixable: true });
  });
  it("parses ruff json and cargo json-lines", () => {
    const r = parseRuffJson([{ filename: "a.py", location: { row: 3, column: 1 }, code: "F401", message: "unused" }]);
    expect(r[0]).toMatchObject({ file: "a.py", line: 3 });
    const cargo = parseCargoCheck(
      `{"reason":"compiler-message","message":{"level":"error","message":"boom","spans":[{"file_name":"src/main.rs","line_start":4,"column_start":2,"is_primary":true}]}}\nnot json\n`,
    );
    expect(cargo[0]).toMatchObject({ file: "src/main.rs", line: 4, severity: "error" });
  });
});

describe("lintTypecheck runner", () => {
  it("merges checkers and filters severity", async () => {
    const r = await lintTypecheck(
      { tsc: async () => "a.ts(1,1): error TS1: e\na.ts(2,1): warning TS2: w" },
      { paths: ["a.ts"], severity: "error" },
    );
    expect(r.diagnostics).toHaveLength(1);
    expect(r.checkers).toContain("tsc");
  });
  it("fix:true without fixer returns fixApplied:false", async () => {
    const r = await lintTypecheck({ tsc: async () => "" }, { paths: ["a.ts"], fix: true });
    expect(r.fixApplied).toBe(false);
  });
  it("applies fixes when supported", async () => {
    const r = await lintTypecheck({ applyFixes: async () => 3 }, { fix: true });
    expect(r.fixApplied).toBe(true);
    expect(r.fixesApplied).toBe(3);
  });
  it("no checkers notes it", async () => {
    const r = await lintTypecheck({}, { paths: ["weird.xyz"] });
    expect(r.diagnostics).toEqual([]);
    expect(r.note).toBeDefined();
  });
});
