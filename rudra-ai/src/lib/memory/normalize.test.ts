import { describe, expect, it } from "vitest";
import type { Memory } from "./types";
import { classifyCandidate, dedupeCandidates } from "./normalize";

function mem(partial: Partial<Memory> = {}): Memory {
  return {
    id: "m1",
    category: "social",
    key: "github",
    value: "@old",
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

describe("classifyCandidate", () => {
  it("inserts when no holder exists", () => {
    expect(
      classifyCandidate([], { category: "social", key: "github", value: "@x", confidence: 0.9, excerpt: "e" }),
    ).toEqual({ action: "insert" });
  });

  it("confirms on equal value (case-insensitive)", () => {
    const c = classifyCandidate([mem({ value: "@Old" })], {
      category: "social",
      key: "github",
      value: "@old",
      confidence: 0.7,
      excerpt: "e",
    });
    expect(c).toEqual({ action: "confirm", existingId: "m1" });
  });

  it("flags conflicts on different values", () => {
    const c = classifyCandidate([mem()], {
      category: "social",
      key: "github",
      value: "@new",
      confidence: 0.9,
      excerpt: "e",
    });
    expect(c).toEqual({ action: "conflict", existingId: "m1" });
  });
});

describe("dedupeCandidates", () => {
  it("keeps the last value per slot", () => {
    const out = dedupeCandidates([
      { category: "social", key: "github", value: "@a", confidence: 0.5, excerpt: "1" },
      { category: "social", key: "github", value: "@b", confidence: 0.9, excerpt: "2" },
    ]);
    expect(out.length).toBe(1);
    expect(out[0]?.value).toBe("@b");
  });
});
