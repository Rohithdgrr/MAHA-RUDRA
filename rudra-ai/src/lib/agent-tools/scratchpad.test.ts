import { describe, expect, it } from "vitest";
import { MemoryKV, scratchpad } from "./scratchpad";
import { ToolError } from "./types";

describe("scratchpad", () => {
  it("write/read/append/clear round-trip", () => {
    const kv = new MemoryKV();
    scratchpad(kv, { op: "write", key: "plan", value: "step1" });
    expect(scratchpad(kv, { op: "read", key: "plan" }).value).toBe("step1");
    scratchpad(kv, { op: "append", key: "plan", value: "step2" });
    expect(scratchpad(kv, { op: "read", key: "plan" }).value).toContain("step2");
    scratchpad(kv, { op: "clear", key: "plan" });
    expect(scratchpad(kv, { op: "read", key: "plan" }).value).toBeUndefined();
  });
  it("read without key lists keys; clear without key clears all", () => {
    const kv = new MemoryKV();
    scratchpad(kv, { op: "write", key: "a", value: "1" });
    expect(scratchpad(kv, { op: "read" }).keys).toContain("a");
    scratchpad(kv, { op: "clear" });
    expect(scratchpad(kv, { op: "read" }).keys).toEqual([]);
  });
  it("validates keys and sizes", () => {
    const kv = new MemoryKV();
    expect(() => scratchpad(kv, { op: "write", value: "x" })).toThrow(ToolError);
    expect(() => scratchpad(kv, { op: "write", key: "bad key!", value: "x" })).toThrow(ToolError);
    expect(() => scratchpad(kv, { op: "write", key: "k", value: "x".repeat(100_001) })).toThrow(ToolError);
  });
  it("append to missing creates; append overflow rejected", () => {
    const kv = new MemoryKV();
    scratchpad(kv, { op: "append", key: "log", value: "first" });
    expect(scratchpad(kv, { op: "read", key: "log" }).value).toBe("first");
    kv.set("scratchpad:big", "x".repeat(99_999));
    expect(() => scratchpad(kv, { op: "append", key: "big", value: "y".repeat(100) })).toThrow(ToolError);
  });
});
