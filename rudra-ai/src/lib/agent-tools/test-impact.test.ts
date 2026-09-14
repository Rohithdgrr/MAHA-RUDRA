import { describe, expect, it } from "vitest";
import { collapseTestResults, isTestFile, planTestImpact, summarizeTestOutput } from "./test-impact";
import { ToolError } from "./types";

const entries = [
  { path: "src/foo.ts", content: "export const a = 1;" },
  { path: "src/bar.ts", content: "import {a} from './foo';" },
  { path: "src/foo.test.ts", content: "import {a} from './foo';" },
  { path: "src/other.test.ts", content: "const x = 1;" },
];

describe("testImpact", () => {
  it("selects tests depending on changed file", () => {
    const p = planTestImpact(entries, { changed: ["src/foo.ts"] });
    expect(p.testsToRun).toContain("src/foo.test.ts");
    expect(p.testsToRun).not.toContain("src/other.test.ts");
    expect(p.testsSkipped).toBe(1);
  });
  it("changed test file always runs (direct fallback)", () => {
    const p = planTestImpact(entries, { changed: ["src/other.test.ts"] });
    expect(p.testsToRun).toContain("src/other.test.ts");
  });
  it("empty changes run nothing", () => {
    const p = planTestImpact(entries, { changed: [] });
    expect(p.testsToRun).toEqual([]);
    expect(p.reason).toMatch(/no changes/);
  });
  it("no test files handled", () => {
    const p = planTestImpact([{ path: "src/a.ts", content: "" }], { changed: ["src/a.ts"] });
    expect(p.testsToRun).toEqual([]);
  });
  it("validates depth", () => {
    expect(() => planTestImpact(entries, { depth: -1 })).toThrow(ToolError);
    expect(() => planTestImpact(entries, { depth: 99 })).toThrow(ToolError);
  });
  it("isTestFile covers conventions", () => {
    expect(isTestFile("a.test.ts")).toBe(true);
    expect(isTestFile("pkg_test.go")).toBe(true);
    expect(isTestFile("test_x.py")).toBe(true);
    expect(isTestFile("src/app.ts")).toBe(false);
  });
});

describe("summarizeTestOutput", () => {
  it("parses cargo test-result lines", () => {
    const s = summarizeTestOutput("test result: FAILED. 398 passed; 2 failed, 0 ignored");
    expect(s).toMatchObject({ passed: 398, failed: 2, total: 400 });
    expect(collapseTestResults(s)).toBe("398 passed, 2 failed");
  });
  it("parses pytest summary + FAILED names", () => {
    const s = summarizeTestOutput("FAILED tests/test_x.py::test_a\n2 failed, 10 passed in 3s");
    expect(s.failed).toBe(3);
    expect(s.failedNames).toContain("tests/test_x.py::test_a");
    expect(collapseTestResults(s)).toContain("failed: [");
  });
  it("parses vitest × / FAIL lines and cargo per-test lines", () => {
    const s = summarizeTestOutput("× src/a.test.ts > adds (12ms)\ntest auth::login ... FAILED\ntest auth::ok ... ok");
    expect(s.failed).toBe(2);
    expect(s.passed).toBe(1);
    expect(s.failedNames).toContain("auth::login");
  });
  it("collapses clean runs and empty output", () => {
    expect(collapseTestResults(summarizeTestOutput("Tests 106 passed (106)"))).toBe("106 passed");
    expect(collapseTestResults({ passed: 5, failed: 0, failedNames: [], total: 5 })).toBe("5 passed");
    expect(collapseTestResults(summarizeTestOutput("garbage\nmore garbage"))).toBe("no test results parsed");
  });
  it("never throws on hostile input", () => {
    expect(() => summarizeTestOutput("")).not.toThrow();
    expect(summarizeTestOutput("")).toMatchObject({ passed: 0, failed: 0, total: 0 });
  });
});
