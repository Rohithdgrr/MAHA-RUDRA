import { describe, expect, it } from "vitest";
import { parallelSubagents } from "./parallel-subagents";
import { ToolError } from "./types";

describe("parallelSubagents", () => {
  it("fans out and concats results", async () => {
    const r = await parallelSubagents(
      async (t) => ({ output: `done:${t.id}`, tokens_used: 10 }),
      { tasks: [{ id: "a", goal: "g1" }, { id: "b", goal: "g2" }], max_concurrency: 2 },
    );
    expect(r.results).toHaveLength(2);
    expect(r.results.every((x) => x.status === "ok")).toBe(true);
    expect(r.merged).toContain("done:a");
  });
  it("captures per-task errors without failing batch", async () => {
    const r = await parallelSubagents(
      async (t) => {
        if (t.id === "bad") throw new Error("boom");
        return { output: "ok" };
      },
      { tasks: [{ id: "bad", goal: "g" }, { id: "good", goal: "g" }] },
    );
    expect(r.results.find((x) => x.id === "bad")?.status).toBe("error");
    expect(r.results.find((x) => x.id === "good")?.status).toBe("ok");
  });
  it("times out slow tasks", async () => {
    const r = await parallelSubagents(
      async () => {
        await new Promise((res) => setTimeout(res, 200));
        return { output: "late" };
      },
      { tasks: [{ id: "s", goal: "g", timeout_ms: 20 }] },
    );
    expect(r.results[0]?.status).toBe("timeout");
  });
  it("first_success merges first ok", async () => {
    const r = await parallelSubagents(async (t) => ({ output: t.id }), {
      tasks: [{ id: "a", goal: "g" }, { id: "b", goal: "g" }],
      merge: "first_success",
    });
    expect(["a", "b"]).toContain(r.merged);
  });
  it("rejects edit tools, dup ids, empty tasks", async () => {
    await expect(
      parallelSubagents(async () => ({ output: "" }), { tasks: [] }),
    ).rejects.toThrow(ToolError);
    await expect(
      parallelSubagents(async () => ({ output: "" }), {
        tasks: [{ id: "a", goal: "g", tools: ["batch_edit"] }],
      }),
    ).rejects.toThrow(ToolError);
    await expect(
      parallelSubagents(async () => ({ output: "" }), {
        tasks: [{ id: "a", goal: "g" }, { id: "a", goal: "h" }],
      }),
    ).rejects.toThrow(ToolError);
  });
  it("truncates huge outputs", async () => {
    const r = await parallelSubagents(async () => ({ output: "x".repeat(20000) }), {
      tasks: [{ id: "a", goal: "g" }],
    });
    expect((r.results[0]?.output ?? "").length).toBeLessThanOrEqual(8000);
  });
});
