import { describe, expect, it } from "vitest";
import { DEFAULT_ABORT_PATTERNS, isBlockedCommand, matchAbortPatterns, runVerify } from "./run-verify";
import { ToolError } from "./types";

describe("runVerify", () => {
  it("passes on exit 0 with stdout_contains", async () => {
    const r = await runVerify(
      { exec: async () => ({ exitCode: 0, stdout: "42 passed", stderr: "", durationMs: 5 }) },
      { cmd: "npm run test", expect: { exit_code: 0, stdout_contains: "42 passed" } },
    );
    expect(r.passed).toBe(true);
    expect(r.matched).toBe(true);
  });
  it("fails when expectation mismatches", async () => {
    const r = await runVerify(
      { exec: async () => ({ exitCode: 0, stdout: "1 failed", stderr: "", durationMs: 5 }) },
      { cmd: "npm run test", expect: { stdout_contains: "42 passed" } },
    );
    expect(r.passed).toBe(false);
  });
  it("supports stdout_matches regex; bad regex is BAD_INPUT", async () => {
    const ok = await runVerify(
      { exec: async () => ({ exitCode: 0, stdout: "ok 12", stderr: "", durationMs: 1 }) },
      { cmd: "x", expect: { stdout_matches: "ok \\d+" } },
    );
    expect(ok.matched).toBe(true);
    await expect(
      runVerify({ exec: async () => ({ exitCode: 0, stdout: "x", stderr: "", durationMs: 1 }) }, { cmd: "x", expect: { stdout_matches: "([" } }),
    ).rejects.toThrow(ToolError);
  });
  it("truncates tails to 200 lines", async () => {
    const big = Array.from({ length: 500 }, (_, i) => `l${i}`).join("\n");
    const r = await runVerify(
      { exec: async () => ({ exitCode: 0, stdout: big, stderr: "", durationMs: 1 }) },
      { cmd: "x" },
    );
    expect(r.stdout_tail.split("\n")).toHaveLength(200);
  });
  it("maps runner timeout to timedOut result", async () => {
    const r = await runVerify(
      {
        exec: async () => {
          throw new Error("timed out waiting");
        },
      },
      { cmd: "sleep 99" },
    );
    expect(r.timedOut).toBe(true);
    expect(r.passed).toBe(false);
  });
  it("blocks git commit/push; requires runner; validates cmd", async () => {    expect(isBlockedCommand("git push origin main")).toBe(true);
    expect(isBlockedCommand("npm run test")).toBe(false);
    await expect(runVerify(undefined, { cmd: "x" })).rejects.toThrow(ToolError);
    await expect(
      runVerify({ exec: async () => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 1 }) }, { cmd: "  " }),
    ).rejects.toThrow(ToolError);
    await expect(
      runVerify({ exec: async () => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 1 }) }, { cmd: "git commit -m x" }),
    ).rejects.toThrow(ToolError);
  });
});

describe("matchAbortPatterns", () => {
  it("matches first hit, tolerates bad regex as substring", () => {
    expect(matchAbortPatterns("src/a.ts(1,1): error TS2322: bad", DEFAULT_ABORT_PATTERNS)).toContain("TS");
    expect(matchAbortPatterns("all good", DEFAULT_ABORT_PATTERNS)).toBeUndefined();
    expect(matchAbortPatterns("boom ([", ["([", "boom"])).toBe("([");
    expect(matchAbortPatterns("x", ["  ", ""])).toBeUndefined();
  });
});
