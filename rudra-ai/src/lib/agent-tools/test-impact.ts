/** test_impact: run only tests whose transitive imports touch changed files. */
import { buildImportGraph, reverseDeps, type FileEntry } from "./import-graph";
import { ToolError } from "./types";

export interface TestImpactInput {
  changed?: string[];
  depth?: number;
  diffSinceCheckpoint?: string[];
}

export interface TestImpactPlan {
  testsToRun: string[];
  testsSkipped: number;
  changed: string[];
  reason: string;
}

export interface TestSummary {
  passed: number;
  failed: number;
  failedNames: string[];
  total: number;
}

/** Collapse noisy runner output to `"398 passed, 2 failed: [a, b]"`.
 *  Understands vitest (`✓/×/FAIL`), cargo (`test result: ok. 398 passed; 2 failed`)
 *  and pytest (`2 failed, 398 passed` / `FAILED test_x`) shapes. Tolerant: unknown
 *  lines are ignored, never throw. */
export function summarizeTestOutput(text: string): TestSummary {
  let passed = 0;
  let failed = 0;
  const failedNames: string[] = [];
  const pushFail = (name: string) => {
    const n = name.trim().slice(0, 160);
    if (n && !failedNames.includes(n) && failedNames.length < 50) failedNames.push(n);
  };
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    let m = line.match(/^test result:\s*(ok|FAILED)\.\s*(\d+)\s+passed;\s*(\d+)\s+failed/i);
    if (m) {
      passed += parseInt(m[2] ?? "0", 10);
      failed += parseInt(m[3] ?? "0", 10);
      continue;
    }
    m = line.match(/(\d+)\s+failed,\s*(\d+)\s+passed/i);
    if (m) {
      failed += parseInt(m[1] ?? "0", 10);
      passed += parseInt(m[2] ?? "0", 10);
      continue;
    }
    m = line.match(/(\d+)\s+passed,\s*(\d+)\s+failed/i);
    if (m) {
      passed += parseInt(m[1] ?? "0", 10);
      failed += parseInt(m[2] ?? "0", 10);
      continue;
    }
    m = line.match(/(\d+)\s+failed\b/i);
    if (m) {
      failed += parseInt(m[1] ?? "0", 10);
      continue;
    }
    m = line.match(/(\d+)\s+passed\b/i);
    if (m) {
      passed += parseInt(m[1] ?? "0", 10);
      continue;
    }
    m = line.match(/^(?:FAIL|×|✗|failed)\s+(.+)$/i);
    if (m && m[1]) {
      failed += 1;
      pushFail(m[1].replace(/\s*\(\d+ms\)?\s*$/, ""));
      continue;
    }
    m = line.match(/^FAILED\s+(\S+)/);
    if (m && m[1]) {
      failed += 1;
      pushFail(m[1]);
      continue;
    }
    m = line.match(/^test\s+(\S+)\s+\.\.\.\s+(ok|FAILED)/);
    if (m) {
      if ((m[2] ?? "").toUpperCase() === "OK") passed += 1;
      else {
        failed += 1;
        if (m[1]) pushFail(m[1]);
      }
    }
  }
  return { passed, failed, failedNames, total: passed + failed };
}

/** One-line verdict for the agent. Lists only failures (~50× smaller than raw logs). */
export function collapseTestResults(summary: TestSummary): string {
  if (summary.total === 0) return "no test results parsed";
  if (summary.failed === 0) return `${summary.passed} passed`;
  const names = summary.failedNames.length > 0 ? `: [${summary.failedNames.slice(0, 10).join(", ")}]` : "";
  return `${summary.passed} passed, ${summary.failed} failed${names}`;
}

const TEST_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /_test\.go$/,
  /_test\.py$/,
  /^tests?\//,
  /__tests__\//,
  /^test_.*\.py$/,
];

export function isTestFile(path: string): boolean {
  const p = path.replace(/\\/g, "/");
  return TEST_PATTERNS.some((re) => re.test(p));
}

function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function planTestImpact(
  entries: FileEntry[],
  input: TestImpactInput = {},
): TestImpactPlan {
  const depth = input.depth ?? 2;
  if (!Number.isInteger(depth) || depth < 0 || depth > 10)
    throw new ToolError("BAD_INPUT", "depth must be an integer 0..10");
  const changed = (input.changed ?? input.diffSinceCheckpoint ?? []).map(normalize);
  const allFiles = entries.map((e) => normalize(e.path));
  const testFiles = allFiles.filter(isTestFile);
  if (changed.length === 0) {
    return { testsToRun: [], testsSkipped: testFiles.length, changed: [], reason: "no changes detected" };
  }
  if (testFiles.length === 0) {
    return { testsToRun: [], testsSkipped: 0, changed, reason: "no test files in workspace" };
  }
  const graph = buildImportGraph(entries);
  const impacted = reverseDeps(graph, changed, depth);
  // a test is affected if it is itself changed, or it (transitively) depends on a changed file
  const toRun = testFiles.filter((t) => impacted.has(t));
  // direct-change fallback: changed test files always run even if graph missed the edge
  for (const c of changed) {
    if (isTestFile(c) && allFiles.includes(c) && !toRun.includes(c)) toRun.push(c);
  }
  return {
    testsToRun: toRun.sort(),
    testsSkipped: testFiles.length - toRun.length,
    changed,
    reason: toRun.length === 0 ? "no tests depend on changed files" : "affected tests selected",
  };
}
