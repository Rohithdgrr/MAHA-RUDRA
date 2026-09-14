import { describe, expect, it } from "vitest";
import { memoryToJson, memoryToMarkdown } from "./export";
import type { Memory } from "./types";

function mem(partial: Partial<Memory> = {}): Memory {
  return {
    id: "m1",
    category: "social",
    key: "github",
    value: "@x",
    confidence: 1,
    status: "active",
    sensitive: false,
    source: { sessionId: "s", messageId: "m", excerpt: "e", timestamp: 1 },
    createdAt: 1,
    updatedAt: 1,
    lastConfirmedAt: 1,
    ...partial,
  } as Memory;
}

describe("memory export", () => {
  it("round-trips JSON", () => {
    const ms = [mem()];
    expect(JSON.parse(memoryToJson(ms))).toHaveLength(1);
    expect(memoryToJson([])).toBe("[]");
  });

  it("groups by category and flags sensitive", () => {
    const md = memoryToMarkdown([
      mem(),
      mem({ id: "m2", category: "contact", key: "email", value: "a@b.c", sensitive: true }),
      mem({ id: "m3", status: "pending", key: "editor", category: "preferences", value: "vim" }),
    ]);
    expect(md).toContain("## Social & profiles");
    expect(md).toContain("🔒");
    expect(md).toContain("## Awaiting review");
  });

  it("handles empty stores", () => {
    expect(memoryToMarkdown([])).toContain("No memories");
  });
});
