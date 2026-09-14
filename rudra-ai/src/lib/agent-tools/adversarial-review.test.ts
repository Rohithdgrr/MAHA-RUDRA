import { describe, expect, it } from "vitest";
import { adversarialReview } from "./adversarial-review";
import { ToolError } from "./types";

describe("adversarialReview", () => {
  it("returns sorted coerced findings", async () => {
    const r = await adversarialReview(
      async () => [
        { severity: "info", file: "b.ts", line: 1, category: "style", message: "nit" },
        { severity: "error", file: "a.ts", line: 5, category: "security", message: "xss", suggested_fix: "escape" },
        { severity: "bogus", file: "c.ts", message: "skip me" },
      ],
      { diff: "diff text", max_findings: 10 },
    );
    expect(r.findings[0]?.severity).toBe("error");
    expect(r.findings).toHaveLength(2);
  });
  it("empty diff returns no findings without calling reviewer", async () => {
    let called = false;
    const r = await adversarialReview(
      async () => {
        called = true;
        return [];
      },
      { diff: "   " },
    );
    expect(r.findings).toEqual([]);
    expect(called).toBe(false);
  });
  it("falls back to unstaged diff provider", async () => {
    const r = await adversarialReview(async () => [], {
      getUnstagedDiff: async () => "abc",
    });
    expect(r.reviewedChars).toBe(3);
  });
  it("reviewer failure surfaces EXEC_FAILED; missing reviewer is UNAVAILABLE", async () => {
    await expect(
      adversarialReview(
        async () => {
          throw new Error("down");
        },
        { diff: "x" },
      ),
    ).rejects.toThrow(ToolError);
    await expect(adversarialReview(undefined, { diff: "x" })).rejects.toThrow(ToolError);
  });
  it("rejects oversized diff and caps findings", async () => {
    await expect(adversarialReview(async () => [], { diff: "x".repeat(200_001) })).rejects.toThrow(ToolError);
    const r = await adversarialReview(
      async () => Array.from({ length: 30 }, (_, i) => ({ severity: "warning", file: "a", line: i + 1, category: "c", message: `m${i}` })),
      { diff: "x", max_findings: 5 },
    );
    expect(r.findings).toHaveLength(5);
  });
});
