import { describe, expect, it } from "vitest";
import { PROMPT_FRAME_VERSION, assemblePrompt } from "./framing";

describe("assemblePrompt", () => {
  it("emits frozen section order with stable separators", () => {
    const a = assemblePrompt({ system: "sys", memoryBlock: "mem", toolPolicy: "tools", userText: "hi" });
    expect(a.text).toBe("sys\n\nmem\n\ntools\n\nhi");
    expect(a.sections.map((s) => s.name)).toEqual(["system", "memory", "tool-policy", "user"]);
    expect(a.cacheablePrefixTokens).toBeGreaterThan(0);
    const b = assemblePrompt({ system: "sys", memoryBlock: "mem", toolPolicy: "tools", userText: "hi" });
    expect(b.text).toBe(a.text);
  });
  it("skips empty sections but keeps order", () => {
    const r = assemblePrompt({ userText: "hi" });
    expect(r.sections.map((s) => s.name)).toEqual(["user"]);
    expect(r.cacheablePrefixTokens).toBe(0);
  });
  it("prefix ends at the user section", () => {
    const r = assemblePrompt({ system: "abcd", userText: "efgh" });
    expect(r.cacheablePrefixTokens).toBe(1);
  });
  it("rejects empty user text", () => {
    expect(() => assemblePrompt({ userText: "  " })).toThrow();
  });
  it("exposes a frame version for cache invalidation", () => {
    expect(PROMPT_FRAME_VERSION).toBe(1);
  });
});
