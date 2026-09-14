import { describe, expect, it } from "vitest";
import { gitHistory, parseBlamePorcelain } from "./git-history";
import { ToolError } from "./types";

const runner = {
  exec: async (args: string[]) => {
    if (args[0] === "blame") return "abc123 1 1 1\nauthor Jane\nsummary fix it\n\tline one\n";
    if (args[0] === "log") return "h1\x1fJane\x1f2024-01-01\x1fmsg\n";
    if (args[0] === "diff") return "diff --git ...";
    return "";
  },
  gh: async () => JSON.stringify({ title: "PR", body: "body", comments: [{ body: "lgtm" }] }),
};

describe("gitHistory", () => {
  it("parses blame porcelain", () => {
    const b = parseBlamePorcelain("abc 1 1 1\nauthor J\nsummary s\n\tcode\n");
    expect(b[0]).toMatchObject({ author: "J", message: "s" });
  });
  it("blame validates file + range", async () => {
    await expect(gitHistory(runner, { op: "blame" })).rejects.toThrow(ToolError);
    await expect(gitHistory(runner, { op: "blame", file: "a", line_start: 5, line_end: 2 })).rejects.toThrow(
      ToolError,
    );
    const r = await gitHistory(runner, { op: "blame", file: "a.ts", line_start: 1, line_end: 1 });
    expect(r.blame?.[0]?.author).toBe("Jane");
  });
  it("log parses records", async () => {
    const r = await gitHistory(runner, { op: "log", file: "a.ts" });
    expect(r.log?.[0]).toMatchObject({ hash: "h1" });
  });
  it("diff_between requires base+head", async () => {
    await expect(gitHistory(runner, { op: "diff_between", base: "a" })).rejects.toThrow(ToolError);
    const r = await gitHistory(runner, { op: "diff_between", base: "a", head: "b" });
    expect(r.diff).toContain("diff");
  });
  it("pr_context parses gh json", async () => {
    const r = await gitHistory(runner, { op: "pr_context", pr: 12 });
    expect(r.pr?.title).toBe("PR");
    await expect(gitHistory(runner, { op: "pr_context" })).rejects.toThrow(ToolError);
  });
  it("bisect disabled + missing runner handled", async () => {
    await expect(gitHistory(runner, { op: "bisect", failingCommand: "npm test" })).rejects.toThrow(ToolError);
    await expect(gitHistory(undefined, { op: "log" })).rejects.toThrow(ToolError);
  });
});
