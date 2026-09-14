import { describe, expect, it } from "vitest";
import { buildTranscript, parseExtractionJson } from "./extract";

describe("parseExtractionJson", () => {
  it("parses a clean array", () => {
    const out = parseExtractionJson(
      `[{"category":"social","key":"github","value":"@x","confidence":0.9,"excerpt":"my github is @x"}]`,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ category: "social", key: "github" });
  });

  it("tolerates fences and drops invalid entries", () => {
    const out = parseExtractionJson(
      '```json\n[{"category":"nope","key":"a","value":"b"},{"category":"social","key":"github","value":"@x"}]\n```',
    );
    expect(out).toHaveLength(1);
  });

  it("drops secrets and returns [] for garbage", () => {
    expect(parseExtractionJson("no json here")).toEqual([]);
    expect(
      parseExtractionJson(`[{"category":"custom","key":"k","value":"sk-ant-abcdefgh12345678","confidence":1}]`),
    ).toEqual([]);
  });
});

describe("buildTranscript", () => {
  it("formats user/assistant lines and skips empty parts", () => {
    const out = buildTranscript([
      { info: { role: "user" }, parts: [{ type: "text", text: "hi" }] },
      { info: { role: "assistant" }, parts: [{ type: "tool", text: "x" }] },
    ] as never);
    expect(out).toBe("user: hi");
  });
});
